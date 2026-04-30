import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  MAINNET_USDC,
  LAUNCHPAD_V0_8_PROGRAM_ID,
  LAUNCHPAD_V0_8_MAINNET_METEORA_CONFIG,
} from "@metadaoproject/programs";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad/v0.8";
import BN from "bn.js";
import { initializeMintWithSeeds } from "../launchpad_v8/utils.js";
import { createLookupTableForTransaction, expectError } from "../utils.js";

// Hardcoded from programs/v08_launchpad/src/lib.rs:30-48 (not SDK-exported).
const PRICE_SCALE = new BN("1000000000000"); // 1e12
const TOKENS_TO_PARTICIPANTS = new BN(10_000_000_000_000); // 10M tokens × 1e6
const PP_TWAP_MIN_DURATION_SEC = 3 * 30 * 24 * 60 * 60; // 7_776_000

export default async function suite() {
  before(async function () {
    const dynamicConfig = await this.banksClient.getAccount(
      new PublicKey("4mPQ4VuvvtYL3CeMPt14Uj1CLpBWcVdJoLoTH9ea4Kod"),
    );

    const poolCreatorAuthorityOffset = 8 + 32;
    const configTypeOffset = 8 + 32 + 32 + 128 + 1 + 1;

    const [poolCreatorAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("damm_pool_creator_authority")],
      LAUNCHPAD_V0_8_PROGRAM_ID,
    );

    dynamicConfig.data.set(
      poolCreatorAuthority.toBuffer(),
      poolCreatorAuthorityOffset,
    );
    dynamicConfig.data.set([1], configTypeOffset);

    this.context.setAccount(
      LAUNCHPAD_V0_8_MAINNET_METEORA_CONFIG,
      dynamicConfig,
    );
  });

  it("trades the AMM up through every tranche and unlocks the full performance package", async function () {
    // 620 cranking swaps + 5 unlock cycles. Bankrun is fast but JS RPC
    // overhead per tx still adds up; give it 5 minutes.
    this.timeout(5 * 60 * 1000);

    const launchpadClient: LaunchpadClient = this.launchpad_v8;
    const futarchyClient = launchpadClient.futarchyClient;

    const funder1 = Keypair.generate();
    const funder2 = Keypair.generate();
    const funder3 = Keypair.generate();
    const launchAuthority = Keypair.generate();
    const grantee = Keypair.generate();
    const additionalTokensRecipient = Keypair.generate();

    const minRaise = new BN(300_000 * 10 ** 6);
    const launchPeriod = 60 * 60 * 24 * 2;
    const monthlySpendingLimitAmount = new BN(25_000 * 10 ** 6);
    const performancePackageTokenAmount = new BN(5_000_000 * 10 ** 6); // 5M
    const additionalTokensAmount = new BN(1_000_000 * 10 ** 6);
    const monthsUntilInsidersCanUnlock = 24;
    const totalApproved = new BN(500_000 * 10 ** 6); // 250 + 100 + 150

    const launchPrice = totalApproved
      .mul(PRICE_SCALE)
      .div(TOKENS_TO_PARTICIPANTS);

    // ============================================================
    // Phase A — Lifecycle (init → … → claim_additional)
    // Mirrors launchpad_v8_full_lifecycle.test.ts:50-446 without the
    // intermediate assertions; those are owned by that test and the
    // per-instruction unit tests.
    // ============================================================

    const result = await initializeMintWithSeeds(
      this.banksClient,
      launchpadClient,
      this.payer,
    );
    const META = result.tokenMint;
    const launch = result.launch;
    const launchSigner = result.launchSigner;

    await this.createTokenAccount(MAINNET_USDC, funder1.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder2.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder3.publicKey);

    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder1.publicKey,
      500_000_000000,
    );
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder2.publicKey,
      200_000_000000,
    );
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder3.publicKey,
      400_000_000000,
    );

    await launchpadClient
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: minRaise,
        secondsForLaunch: launchPeriod,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount,
        monthlySpendingLimitMembers: [this.payer.publicKey],
        performancePackageGrantee: grantee.publicKey,
        performancePackageTokenAmount,
        monthsUntilInsidersCanUnlock,
        teamAddress: PublicKey.default,
        launchAuthority: launchAuthority.publicKey,
        additionalTokensRecipient: additionalTokensRecipient.publicKey,
        additionalTokensAmount,
        hasBidWall: false,
      })
      .rpc();

    await launchpadClient
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();

    await launchpadClient
      .fundIx({
        launch,
        amount: new BN(500_000_000000),
        funder: funder1.publicKey,
      })
      .signers([funder1])
      .rpc();
    await launchpadClient
      .fundIx({
        launch,
        amount: new BN(200_000_000000),
        funder: funder2.publicKey,
      })
      .signers([funder2])
      .rpc();
    await launchpadClient
      .fundIx({
        launch,
        amount: new BN(400_000_000000),
        funder: funder3.publicKey,
      })
      .signers([funder3])
      .rpc();

    await this.advanceBySeconds(launchPeriod + 1);
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        funder: funder1.publicKey,
        launchAuthority: launchAuthority.publicKey,
        approvedAmount: new BN(250_000_000000),
      })
      .signers([launchAuthority])
      .rpc();
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        funder: funder2.publicKey,
        launchAuthority: launchAuthority.publicKey,
        approvedAmount: new BN(100_000_000000),
      })
      .signers([launchAuthority])
      .rpc();
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        funder: funder3.publicKey,
        launchAuthority: launchAuthority.publicKey,
        approvedAmount: new BN(150_000_000000),
      })
      .signers([launchAuthority])
      .rpc();

    const settleTx = await launchpadClient
      .settleLaunchIx({
        launch,
        baseMint: META,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .transaction();

    const lut = await createLookupTableForTransaction(settleTx, this);

    const settleMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: settleTx.instructions,
    }).compileToV0Message([lut]);

    const settleVersionedTx = new VersionedTransaction(settleMessage);
    settleVersionedTx.sign([this.payer, launchAuthority]);

    await this.banksClient.processTransaction(settleVersionedTx);

    let launchAccount = await launchpadClient.fetchLaunch(launch);
    const dao = launchAccount.dao!;

    await launchpadClient
      .finalizeLaunchIx({
        launch,
        baseMint: META,
        performancePackageGrantee: launchAccount.performancePackageGrantee,
      })
      .rpc();

    await launchpadClient
      .claimIx({ launch, baseMint: META, funder: funder1.publicKey })
      .rpc();
    await launchpadClient
      .claimIx({ launch, baseMint: META, funder: funder2.publicKey })
      .rpc();
    await launchpadClient
      .claimIx({ launch, baseMint: META, funder: funder3.publicKey })
      .rpc();

    await launchpadClient.refundIx({ launch, funder: funder1.publicKey }).rpc();
    await launchpadClient.refundIx({ launch, funder: funder2.publicKey }).rpc();
    await launchpadClient.refundIx({ launch, funder: funder3.publicKey }).rpc();

    await launchpadClient
      .claimAdditionalTokenAllocationIx({
        launch,
        baseMint: META,
        additionalTokensRecipient: additionalTokensRecipient.publicKey,
      })
      .rpc();

    // Capture the post-finalize addresses we'll need below.
    const mintGovernorAddr = launchpadClient.getMintGovernorAddress({
      baseMint: META,
      launchSigner,
    });
    const performancePackageAddr =
      launchpadClient.getLaunchPerformancePackageAddress({ launch });
    const ppMintAuthorityAddr = launchpadClient.getMintAuthorityAddress({
      mintGovernor: mintGovernorAddr,
      authorizedMinter: performancePackageAddr,
    });

    // ============================================================
    // Phase B — Pre-unlock invariants
    // ============================================================

    // Mint authority is now the mint_governor PDA, not the launch_signer.
    const mintAcc = await this.getMint(META);
    assert.ok(mintAcc.mintAuthority.equals(mintGovernorAddr));

    // start_unlock fails before min_unlock_timestamp.
    const earlyStartCallbacks = expectError(
      "UnlockTimestampNotReached",
      "start_unlock should fail before min_unlock_timestamp",
    );
    await launchpadClient.performancePackageV2
      .startUnlockIx({
        performancePackage: performancePackageAddr,
        signer: grantee.publicKey,
        dao,
      })
      .signers([grantee])
      .rpc()
      .then(earlyStartCallbacks[0], earlyStartCallbacks[1]);

    // ============================================================
    // Phase C — Whale buy + advance to min_unlock_timestamp
    // ============================================================

    // Past twap_start_delay (1 day) so update_twap actually moves the aggregator
    // (programs/futarchy/src/state/futarchy_amm.rs:393-396).
    await this.advanceBySeconds(24 * 60 * 60 + 60);

    const whale = Keypair.generate();
    await this.createTokenAccount(MAINNET_USDC, whale.publicKey);
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      whale.publicKey,
      1_000_000_000_000, // $1M
    );

    // ~$1M buy → spot price ≈ 121× launch_price (CPMM math against
    // the 100k USDC + 2M META reserves seeded by settle_launch).
    await futarchyClient
      .spotSwapIx({
        dao,
        baseMint: META,
        swapType: "buy",
        inputAmount: new BN(1_000_000_000_000),
        trader: whale.publicKey,
      })
      .signers([whale])
      .rpc();

    // Advance the rest of the way to min_unlock_timestamp (24 months).
    await this.advanceBySeconds(
      monthsUntilInsidersCanUnlock * 30 * 24 * 60 * 60,
    );

    // ============================================================
    // Phase D — Cranker + 5 unlock cycles at 2/4/8/16/32×
    // ============================================================

    const cranker = Keypair.generate();
    await this.createTokenAccount(MAINNET_USDC, cranker.publicKey);
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      cranker.publicKey,
      100_000_000_000, // $100k — way more than the 620 × $10 ≈ $6 200 we'll spend.
    );

    // Walk last_observation up to targetMultiplier × launch_price by issuing
    // tiny buy swaps spaced ≥61 s apart. Each update_twap moves the
    // observation by at most launch_price/20 (programs/futarchy/src/state/
    // futarchy_amm.rs:339-449). Since the whale buy left last_price ≫ 32×,
    // every crank advances by exactly the cap.
    //
    // Each iteration adds a unique ComputeBudget instruction so the swap
    // signatures don't collide (bankrun rejects duplicates).
    let crankNonce = 0;
    const crankObservationTo = async (targetMultiplier: number) => {
      const target = launchPrice.muln(targetMultiplier);
      while (true) {
        const daoAcc = await futarchyClient.getDao(dao);
        const obs = daoAcc.amm.state.spot.spot.oracle.lastObservation as BN;
        if (obs.gte(target)) return;
        await this.advanceBySeconds(61);
        await futarchyClient
          .spotSwapIx({
            dao,
            baseMint: META,
            swapType: "buy",
            inputAmount: new BN(10_000_000), // 10 USDC
            trader: cranker.publicKey,
          })
          .postInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({
              units: 200_000 + crankNonce++,
            }),
          ])
          .signers([cranker])
          .rpc();
      }
    };

    const granteeAta = await this.createTokenAccount(META, grantee.publicKey);

    const ppAmount = performancePackageTokenAmount;
    const fifth = ppAmount.divn(5); // 1M × 1e6

    const runUnlockCycle = async (
      targetMultiplier: number,
      expectedCumulative: BN,
    ) => {
      await crankObservationTo(targetMultiplier);

      await launchpadClient.performancePackageV2
        .startUnlockIx({
          performancePackage: performancePackageAddr,
          signer: grantee.publicKey,
          dao,
        })
        .signers([grantee])
        .rpc();

      // No swaps fire during this wait, so last_observation stays pinned at
      // targetMultiplier × launch_price. The effective_aggregator extrapolation
      // (programs/performance_package_v2/src/state/performance_package.rs:87-92)
      // makes the TWAP between start_unlock and complete_unlock equal to
      // targetMultiplier × launch_price.
      await this.advanceBySeconds(PP_TWAP_MIN_DURATION_SEC + 60);

      await launchpadClient.performancePackageV2
        .completeUnlockIx({
          performancePackage: performancePackageAddr,
          mintGovernor: mintGovernorAddr,
          mintAuthority: ppMintAuthorityAddr,
          mint: META,
          recipient: grantee.publicKey,
          signer: grantee.publicKey,
          dao,
        })
        .signers([grantee])
        .rpc();

      const granteeBalance = await this.getTokenBalance(
        META,
        grantee.publicKey,
      );
      assert.equal(granteeBalance.toString(), expectedCumulative.toString());

      const pp =
        await launchpadClient.performancePackageV2.fetchPerformancePackage(
          performancePackageAddr,
        );
      assert.equal(
        pp.totalRewardsPaidOut.toString(),
        expectedCumulative.toString(),
      );
      assert.deepEqual(pp.status, { locked: {} });
      assert.equal(pp.oracleReader.futarchyTwap.startValue.toString(), "0");
      assert.equal(pp.oracleReader.futarchyTwap.endValue.toString(), "0");
    };

    await runUnlockCycle(2, fifth.muln(1));
    await runUnlockCycle(4, fifth.muln(2));
    await runUnlockCycle(8, fifth.muln(3));
    await runUnlockCycle(16, fifth.muln(4));
    await runUnlockCycle(32, fifth.muln(5));

    // ============================================================
    // Phase E — Cap assertion
    // ============================================================

    const ppAuthority =
      await launchpadClient.mintGovernorClient.fetchMintAuthority(
        ppMintAuthorityAddr,
      );
    assert.equal(ppAuthority.totalMinted.toString(), ppAmount.toString());
    assert.equal(ppAuthority.maxTotal.toString(), ppAmount.toString());
  });
}
