import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import { LaunchpadClient } from "@metadaoproject/futarchy-v2/launchpad/v0.8";
import { MAINNET_USDC } from "@metadaoproject/futarchy-v2";
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
    await client
      .fundIx({
        launch: opts.launch,
        amount: opts.fundAmount,
        payer: context.payer.publicKey,
      })
      .rpc();

    await context.advanceBySeconds(secondsForLaunch + 1);

    await client.closeLaunchIx({ launch: opts.launch }).rpc();

    await client
      .setFundingRecordApprovalIx({
        launch: opts.launch,
        approvedAmount: opts.fundAmount,
        funder: context.payer.publicKey,
        launchAuthority: opts.launchAuthority.publicKey,
      })
      .signers([opts.launchAuthority])
      .rpc();

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
  });

  it("sets and claims additional token allocation successfully, and only once", async function () {
    const additionalTokensRecipient = new Keypair();
    const additionalTokensAmount = new BN(1_000_000 * 10 ** 6); // 1M tokens

    // Initialize with additional tokens recipient and amount
    await launchpadClient
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: new BN(100_000 * 10 ** 6),
        secondsForLaunch,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: new BN(10_000 * 10 ** 6),
        monthlySpendingLimitMembers: [this.payer.publicKey],
        performancePackageGrantee: this.payer.publicKey,
        performancePackageTokenAmount: new BN(5_000_000 * 10 ** 6),
        monthsUntilInsidersCanUnlock: 24,
        teamAddress: PublicKey.default,
        launchAuthority: launchAuthority.publicKey,
        additionalTokensRecipient: additionalTokensRecipient.publicKey,
        additionalTokensAmount,
        hasBidWall: false,
      })
      .rpc();

    await launchpadClient
      .startLaunchIx({
        launch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    await this.createTokenAccount(META, this.payer.publicKey);

    await setupFundCloseApproveSettle(this, launchpadClient, {
      launch,
      baseMint: META,
      launchAuthority,
      fundAmount: new BN(150_000 * 10 ** 6),
    });

    // Verify launch is complete with additional tokens unclaimed
    const launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { complete: {} });
    assert.equal(launchAccount.additionalTokensClaimed, false);

    // Claim additional tokens
    await launchpadClient
      .claimAdditionalTokenAllocationIx({
        launch,
        baseMint: META,
        additionalTokensRecipient: additionalTokensRecipient.publicKey,
      })
      .rpc();

    // Verify tokens transferred to recipient
    const recipientBalance = await this.getTokenBalance(
      META,
      additionalTokensRecipient.publicKey,
    );
    assert.equal(
      recipientBalance.toString(),
      additionalTokensAmount.toString(),
    );

    // Verify state updated
    const updatedLaunch = await launchpadClient.fetchLaunch(launch);
    assert.equal(updatedLaunch.additionalTokensClaimed, true);

    // Try to claim again — should fail
    try {
      await launchpadClient
        .claimAdditionalTokenAllocationIx({
          launch,
          baseMint: META,
          additionalTokensRecipient: additionalTokensRecipient.publicKey,
        })
        .postInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
        ])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "AdditionalTokensAlreadyClaimed");
    }
  });

  it("fails to claim additional token allocation if the launch doesn't have one", async function () {
    // Standard launch without additional tokens
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

    await setupFundCloseApproveSettle(this, launchpadClient, {
      launch,
      baseMint: META,
      launchAuthority,
      fundAmount: new BN(150_000 * 10 ** 6),
    });

    try {
      await launchpadClient
        .claimAdditionalTokenAllocationIx({
          launch,
          baseMint: META,
          additionalTokensRecipient: this.payer.publicKey,
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "NoAdditionalTokensRecipientSet");
    }
  });
}
