import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Signer,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  FutarchyClient,
  getMetadataAddr,
  LaunchpadClient,
  MAINNET_USDC,
  PriceBasedPerformancePackageClient,
} from "@metadaoproject/programs";
import { BN } from "bn.js";
import { deserializeMetadata } from "@metaplex-foundation/mpl-token-metadata";
import {
  fromWeb3JsPublicKey,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { initializeMintWithSeeds } from "../utils.js";
import { createLookupTableForTransaction } from "../../utils.js";

export default function suite() {
  let futarchyClient: FutarchyClient;
  let launchpadClient: LaunchpadClient;
  let priceBasedPerformancePackageClient: PriceBasedPerformancePackageClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let launchAuthority: Signer;

  const minRaise = new BN(1000_000000); // 1000 USDC
  const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
  const monthlySpend = new BN(100_000000);
  const recipientAddress = Keypair.generate().publicKey;
  const premineAmount = new BN(500_000_000);
  const unlockThreshold = new BN(2000_000000);

  before(async function () {
    futarchyClient = this.futarchy;
    launchpadClient = this.launchpad_v7;
    priceBasedPerformancePackageClient = this.priceBasedPerformancePackage;
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad_v7,
      this.payer,
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;
    launchAuthority = new Keypair();

    // Initialize launch
    await launchpadClient
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: minRaise,
        secondsForLaunch: secondsForLaunch,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: monthlySpend, // 100 USDC burn
        monthlySpendingLimitMembers: [this.payer.publicKey],
        performancePackageGrantee: recipientAddress,
        performancePackageTokenAmount: premineAmount,
        monthsUntilInsidersCanUnlock: 18,
        teamAddress: PublicKey.default,
        launchAuthority: launchAuthority.publicKey,
        hasBidWall: false,
      })
      .rpc();

    await launchpadClient
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    await launchpadClient.fundIx({ launch, amount: minRaise }).rpc();

    // Advance clock past 7 days
    await this.advanceBySeconds(60 * 60 * 24 * 11);

    await launchpadClient.closeLaunchIx({ launch }).rpc();

    await launchpadClient
      .setFundingRecordApprovalIx({
        approvedAmount: minRaise,
        launch,
        funder: this.payer.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();
  });

  it("initializes performance package successfully after launch is complete", async function () {
    // Complete launch
    const completeLaunchTx = await launchpadClient
      .completeLaunchTxBuilder({
        launch,
        quoteMint: MAINNET_USDC,
        baseMint: META,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .transaction();

    const completeLaunchLut = await createLookupTableForTransaction(
      completeLaunchTx,
      this,
    );

    const completeLaunchMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx.instructions,
    }).compileToV0Message([completeLaunchLut]);

    const tx = new VersionedTransaction(completeLaunchMessage);
    tx.sign([this.payer, launchAuthority]);

    await this.banksClient.processTransaction(tx);

    await launchpadClient
      .initializePerformancePackageIx({
        launch,
        payer: this.payer.publicKey,
        baseMint: META,
      })
      .rpc();

    const performancePackage =
      launchpadClient.getLaunchPerformancePackageAddress({ launch });
    const performancePackageAccount =
      await priceBasedPerformancePackageClient.getPerformancePackage(
        performancePackage,
      );

    const dao = launchpadClient.getLaunchDaoAddress({ launch });

    assert.isDefined(performancePackageAccount);

    assert.equal(performancePackageAccount.tranches.length, 5);

    for (
      let trancheIdx = 0;
      trancheIdx < performancePackageAccount.tranches.length;
      trancheIdx++
    ) {
      const tranche = performancePackageAccount.tranches[trancheIdx];

      // 2x, 4x, 8x, 16x, 32x the launch price expressed as 1e12 (0.0001 USDC per token launch price)
      assert.equal(
        tranche.priceThreshold.toString(),
        new BN(2 ** (trancheIdx + 1)).mul(new BN(10 ** 8)).toString(),
      );
      assert.equal(
        tranche.tokenAmount.toString(),
        premineAmount.div(new BN(5)).toString(),
      );
    }

    assert.equal(
      performancePackageAccount.totalTokenAmount.toString(),
      premineAmount.toString(),
    );
    assert.equal(
      performancePackageAccount.alreadyUnlockedAmount.toString(),
      new BN(0).toString(),
    );
    assert.equal(
      performancePackageAccount.minUnlockTimestamp.toNumber(),
      Number((await this.banksClient.getClock()).unixTimestamp) +
        18 * 30 * 24 * 60 * 60, // 18 months from now
    );
    assert.equal(
      performancePackageAccount.oracleConfig.oracleAccount.toString(),
      dao.toString(),
    );
    assert.equal(performancePackageAccount.oracleConfig.byteOffset, 8 + 1); // 8 bytes for `Dao` discriminator, 1 byte for `PoolState` enum discriminator
    assert.equal(
      performancePackageAccount.twapLengthSeconds,
      3 * 30 * 24 * 60 * 60,
    ); // 3 month twap length
    assert.equal(
      performancePackageAccount.recipient.toString(),
      recipientAddress.toString(),
    );
    assert.exists(performancePackageAccount.state.locked);
    assert.equal(
      performancePackageAccount.createKey.toString(),
      launchSigner.toString(),
    );
  });

  it("initializes performance package successfully after launch is complete", async function () {
    // Now launch is closed instead of completed, so performance package cannot be initialized
    try {
      await launchpadClient
        .initializePerformancePackageIx({
          launch,
          payer: this.payer.publicKey,
          baseMint: META,
        })
        .rpc();
    } catch (e) {
      // Throws InvalidDao error because launch is not completed, and thus doesn't have a DAO
      assert.include(e.message, "InvalidDao");
    }
  });

  it("can initialize a performance package only once", async function () {
    // Complete launch
    const completeLaunchTx = await launchpadClient
      .completeLaunchTxBuilder({
        launch,
        quoteMint: MAINNET_USDC,
        baseMint: META,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .transaction();

    const completeLaunchLut = await createLookupTableForTransaction(
      completeLaunchTx,
      this,
    );

    const completeLaunchMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx.instructions,
    }).compileToV0Message([completeLaunchLut]);

    const tx = new VersionedTransaction(completeLaunchMessage);
    tx.sign([this.payer, launchAuthority]);

    await this.banksClient.processTransaction(tx);

    await launchpadClient
      .initializePerformancePackageIx({
        launch,
        payer: this.payer.publicKey,
        baseMint: META,
      })
      .rpc();

    try {
      await launchpadClient
        .initializePerformancePackageIx({
          launch,
          payer: this.payer.publicKey,
          baseMint: META,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
        ])
        .rpc();
    } catch (e) {
      // Throws PerformancePackageAlreadyInitialized error because performance package is already initialized
      assert.include(e.message, "PerformancePackageAlreadyInitialized");
    }
  });
}
