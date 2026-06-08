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
} from "@metadaoproject/programs/launchpad/v0.8";
import { MAINNET_USDC } from "@metadaoproject/programs";
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
      launchAuthority: PublicKey | null;
    },
    additionalSigners: Keypair[] = [],
  ) {
    const settleTx = await client
      .settleLaunchTxBuilder({
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

    await this.createTokenAccount(META, this.payer.publicKey);
  });

  it("allows refunds when launch is in refunding state", async function () {
    // Fund below minimum raise so close_launch sets Refunding
    const fundAmount = new BN(50_000 * 10 ** 6); // 50k USDC (below 100k minimum)

    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc();

    // Advance past launch period and close
    await this.advanceBySeconds(secondsForLaunch + 1);
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    // Verify launch is in Refunding state
    let launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { refunding: {} });

    const initialUsdcBalance = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    // Refund
    await launchpadClient.refundIx({ launch }).rpc();

    const finalUsdcBalance = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    // Full committed amount refunded
    assert.equal(
      (finalUsdcBalance - initialUsdcBalance).toString(),
      fundAmount.toString(),
    );

    // Verify funding record
    const [fundingRecord] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      this.payer.publicKey,
    );
    const fundingRecordAccount =
      await launchpadClient.fetchFundingRecord(fundingRecord);
    assert.equal(fundingRecordAccount.isUsdcRefunded, true);
  });

  it("works for oversubscribed launches", async function () {
    // Fund more than minimum
    const fundAmount = new BN(200_000 * 10 ** 6); // 200k USDC

    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc();

    // Advance past launch period and close
    await this.advanceBySeconds(secondsForLaunch + 1);
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    // Approve only 150k of the 200k
    const approvedAmount = new BN(150_000 * 10 ** 6);
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        approvedAmount,
        funder: this.payer.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    // Settle — transitions to Complete
    await settleViaLut(
      this,
      launchpadClient,
      {
        launch,
        baseMint: META,
        launchAuthority: launchAuthority.publicKey,
      },
      [launchAuthority],
    );

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { complete: {} });

    const initialUsdcBalance = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    // Refund — should get committed - approved = 50k
    await launchpadClient.refundIx({ launch }).rpc();

    const finalUsdcBalance = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    const expectedRefund = fundAmount.sub(approvedAmount); // 200k - 150k = 50k
    assert.equal(
      (finalUsdcBalance - initialUsdcBalance).toString(),
      expectedRefund.toString(),
    );

    // Verify funding record
    const [fundingRecord] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      this.payer.publicKey,
    );
    const fundingRecordAccount =
      await launchpadClient.fetchFundingRecord(fundingRecord);
    assert.equal(fundingRecordAccount.isUsdcRefunded, true);
  });

  it("fails when launch is not in refunding or complete state", async function () {
    // Fund but don't close — launch is still in Funding state
    const fundAmount = new BN(150_000 * 10 ** 6);

    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc();

    try {
      await launchpadClient.refundIx({ launch }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "LaunchNotRefunding");
    }
  });
}
