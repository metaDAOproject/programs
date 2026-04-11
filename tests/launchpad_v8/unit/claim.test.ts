import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  LaunchpadClient,
  getFundingRecordAddr,
} from "@metadaoproject/futarchy-v2/launchpad/v0.8";
import BN from "bn.js";
import { initializeMintWithSeeds } from "../utils.js";
import { createLookupTableForTransaction } from "../../utils.js";

export default function suite() {
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let launchAuthority: Keypair;

  const secondsForLaunch = 60 * 60 * 24 * 4; // 4 days

  before(async function () {
    launchpadClient = this.launchpad_v8;
  });

  async function settleViaLut(
    context: any,
    client: LaunchpadClient,
    params: {
      launch: PublicKey;
      baseMint: PublicKey;
      launchAuthority: PublicKey;
    },
    additionalSigners: Keypair[] = [],
  ) {
    const settleTx = await client
      .settleLaunchIx({
        launch: params.launch,
        baseMint: params.baseMint,
        launchAuthority: params.launchAuthority,
      })
      .transaction();

    const lut = await createLookupTableForTransaction(settleTx, context);

    const message = new TransactionMessage({
      payerKey: context.payer.publicKey,
      recentBlockhash: (await context.banksClient.getLatestBlockhash())[0],
      instructions: settleTx.instructions,
    }).compileToV0Message([lut]);

    const tx = new VersionedTransaction(message);
    tx.sign([context.payer, ...additionalSigners]);

    await context.banksClient.processTransaction(tx);
  }

  async function setupFundCloseApproveSettle(
    context: any,
    client: LaunchpadClient,
    opts: {
      launch: PublicKey;
      baseMint: PublicKey;
      launchAuthority: Keypair;
      fundAmount: BN;
    },
  ) {
    // Fund
    await client
      .fundIx({
        launch: opts.launch,
        amount: opts.fundAmount,
        payer: context.payer.publicKey,
      })
      .rpc();

    // Advance past launch period
    await context.advanceBySeconds(secondsForLaunch + 1);

    // Close
    await client.closeLaunchIx({ launch: opts.launch }).rpc();

    // Approve
    await client
      .setFundingRecordApprovalIx({
        launch: opts.launch,
        approvedAmount: opts.fundAmount,
        funder: context.payer.publicKey,
        launchAuthority: opts.launchAuthority.publicKey,
      })
      .signers([opts.launchAuthority])
      .rpc();

    // Settle
    await settleViaLut(
      context,
      client,
      {
        launch: opts.launch,
        baseMint: opts.baseMint,
        launchAuthority: opts.launchAuthority.publicKey,
      },
      [opts.launchAuthority],
    );
  }

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad_v8,
      this.payer,
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;
    launchAuthority = new Keypair();

    await this.setupBasicLaunch({
      baseMint: META,
      founders: [this.payer.publicKey],
      launchAuthority: launchAuthority.publicKey,
    });

    await launchpadClient
      .startLaunchIx({
        launch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    // Create funder's base token ATA
    await this.createTokenAccount(META, this.payer.publicKey);
  });

  it("successfully claims tokens after launch completion", async function () {
    const fundAmount = new BN(150_000 * 10 ** 6); // 150k USDC

    await setupFundCloseApproveSettle(this, launchpadClient, {
      launch,
      baseMint: META,
      launchAuthority,
      fundAmount,
    });

    // Verify launch is complete
    const launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { complete: {} });

    // Initial token balance should be 0
    const initialBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );
    assert.equal(initialBalance.toString(), "0");

    // Claim
    await launchpadClient.claimIx({ launch, baseMint: META }).rpc();

    // Sole funder gets all TOKENS_TO_PARTICIPANTS (10M tokens)
    const finalBalance = await this.getTokenBalance(META, this.payer.publicKey);
    const expectedTokens = new BN(10_000_000 * 10 ** 6);
    assert.equal(finalBalance.toString(), expectedTokens.toString());

    // Verify funding record state
    const [fundingRecord] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      this.payer.publicKey,
    );
    const fundingRecordAccount =
      await launchpadClient.fetchFundingRecord(fundingRecord);
    assert.equal(fundingRecordAccount.isTokensClaimed, true);
    assert.equal(fundingRecordAccount.isUsdcRefunded, false);
    assert.ok(fundingRecordAccount.funder.equals(this.payer.publicKey));
    assert.ok(fundingRecordAccount.launch.equals(launch));
  });

  it("fails when launch is not complete", async function () {
    const fundAmount = new BN(150_000 * 10 ** 6);

    // Fund but don't close/approve/settle
    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc();

    try {
      await launchpadClient.claimIx({ launch, baseMint: META }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InvalidLaunchState");
    }
  });
}
