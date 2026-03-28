import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  FutarchyClient,
  getMetadataAddr,
  MAINNET_USDC,
} from "@metadaoproject/futarchy-v2";
import {
  getLiquidityPoolAddr,
  getRaydiumCpmmLpMintAddr,
  LaunchpadClient,
} from "@metadaoproject/futarchy-v2/launchpad/v0.6";
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
  let METAKP: Keypair;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;

  const minRaise = new BN(1000_000000); // 1000 USDC
  const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
  const monthlySpend = new BN(100_000000);
  const recipientAddress = Keypair.generate().publicKey;
  const premineAmount = new BN(500_000_000);
  const unlockThreshold = new BN(2000_000000);

  before(async function () {
    futarchyClient = this.futarchy;
    launchpadClient = this.launchpad_v6;
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad_v6,
      this.payer,
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;

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
      })
      .rpc();

    await launchpadClient.startLaunchIx({ launch }).rpc();
    await this.createTokenAccount(META, this.payer.publicKey);
  });

  it("completes launch successfully when minimum raise is met and time has passed", async function () {
    await launchpadClient.fundIx({ launch, amount: minRaise }).rpc();

    const [tokenMetadata] = getMetadataAddr(META);

    let rawStoredMetadata = await this.banksClient.getAccount(tokenMetadata);
    let storedMetadata = deserializeMetadata({
      ...rawStoredMetadata,
      publicKey: fromWeb3JsPublicKey(tokenMetadata),
      owner: fromWeb3JsPublicKey(rawStoredMetadata.owner),
      lamports: {
        basisPoints: BigInt(rawStoredMetadata.lamports),
        identifier: "SOL",
        decimals: 9,
      },
      rentEpoch: rawStoredMetadata.rentEpoch
        ? BigInt(rawStoredMetadata.rentEpoch)
        : undefined,
    });
    assert.ok(
      toWeb3JsPublicKey(storedMetadata.updateAuthority).equals(launchSigner),
    );

    // Advance clock past 7 days
    await this.advanceBySeconds(60 * 60 * 24 * 11);

    await launchpadClient.closeLaunchIx({ launch }).rpc();

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
        launch,
        quoteMint: MAINNET_USDC,
        baseMint: META,
        finalRaiseAmount: null,
        launchAuthority: this.payer.publicKey,
      })
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
    tx.sign([this.payer]);

    await this.banksClient.processTransaction(tx);

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    const treasuryUSDCBalance = await this.getTokenBalance(
      MAINNET_USDC,
      launchAccount.daoVault,
    );

    assert.exists(launchAccount.state.complete);
    assert.equal(
      treasuryUSDCBalance.toString(),
      minRaise.muln(8).divn(10).toString(),
    );
    // assert.isAbove(Number(treasuryLpBalance.toString()), 1000);
    const mint = await this.getMint(META);
    assert.isTrue(mint.mintAuthority.equals(launchAccount.daoVault));
    assert.exists(launchAccount.dao);
    assert.equal(mint.supply, 12_900_000 * 10 ** 6 + Number(premineAmount));

    rawStoredMetadata = await this.banksClient.getAccount(tokenMetadata);
    storedMetadata = deserializeMetadata({
      ...rawStoredMetadata,
      publicKey: fromWeb3JsPublicKey(tokenMetadata),
      owner: fromWeb3JsPublicKey(rawStoredMetadata.owner),
      lamports: {
        basisPoints: BigInt(rawStoredMetadata.lamports),
        identifier: "SOL",
        decimals: 9,
      },
      rentEpoch: rawStoredMetadata.rentEpoch
        ? BigInt(rawStoredMetadata.rentEpoch)
        : undefined,
    });
    assert.ok(
      toWeb3JsPublicKey(storedMetadata.updateAuthority).equals(
        launchAccount.daoVault,
      ),
    );
  });

  it("works with a 0 token premine (today we do a 10 token premine)", async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad_v6,
      this.payer,
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;

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
        performancePackageTokenAmount: new BN(10),
        monthsUntilInsidersCanUnlock: 18,
        teamAddress: PublicKey.default,
      })
      .rpc();

    await launchpadClient.startLaunchIx({ launch }).rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    await launchpadClient.fundIx({ launch, amount: minRaise }).rpc();

    const [tokenMetadata] = getMetadataAddr(META);

    let rawStoredMetadata = await this.banksClient.getAccount(tokenMetadata);
    let storedMetadata = deserializeMetadata({
      ...rawStoredMetadata,
      publicKey: fromWeb3JsPublicKey(tokenMetadata),
      owner: fromWeb3JsPublicKey(rawStoredMetadata.owner),
      lamports: {
        basisPoints: BigInt(rawStoredMetadata.lamports),
        identifier: "SOL",
        decimals: 9,
      },
      rentEpoch: rawStoredMetadata.rentEpoch
        ? BigInt(rawStoredMetadata.rentEpoch)
        : undefined,
    });
    assert.ok(
      toWeb3JsPublicKey(storedMetadata.updateAuthority).equals(launchSigner),
    );

    // Advance clock past 7 days
    await this.advanceBySeconds(60 * 60 * 24 * 11);

    await launchpadClient.closeLaunchIx({ launch }).rpc();

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
        launch,
        quoteMint: MAINNET_USDC,
        baseMint: META,
        finalRaiseAmount: null,
        launchAuthority: this.payer.publicKey,
      })
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
    tx.sign([this.payer]);

    await this.banksClient.processTransaction(tx);

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    const treasuryUSDCBalance = await this.getTokenBalance(
      MAINNET_USDC,
      launchAccount.daoVault,
    );

    assert.exists(launchAccount.state.complete);
    assert.equal(
      treasuryUSDCBalance.toString(),
      minRaise.muln(8).divn(10).toString(),
    );
  });

  // it("fails when launch period has not passed", async function () {
  //   // Fund the launch with exactly minimum raise

  //   await launchpadClient.fundIx({ launch, amount: minRaise }).rpc();

  //   const completeLaunchTx = await launchpadClient
  //     .completeLaunchIx({ launch, quoteMint: MAINNET_USDC, baseMint: META })
  //     .transaction();

  //   const completeLaunchLut = await createLookupTableForTransaction(
  //     completeLaunchTx,
  //     this
  //   );

  //   const completeLaunchMessage = new TransactionMessage({
  //     payerKey: this.payer.publicKey,
  //     recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
  //     instructions: completeLaunchTx.instructions,
  //   }).compileToV0Message([completeLaunchLut]);

  //   const tx = new VersionedTransaction(completeLaunchMessage);
  //   tx.sign([this.payer]);

  //   try {
  //     await this.banksClient.processTransaction(tx);
  //     assert.fail("Should have thrown error");
  //   } catch (error) {
  //     // LaunchPeriodNotOver error code is 6006, which is 0x1776 in hex
  //     assert.isTrue(
  //       error.message.includes("0x1776"),
  //       `Expected error message to contain 0x1776, got: ${error.message}`
  //     );
  //   }

  //   // Advance by 9 days (still not enough)
  //   await this.advanceBySeconds(60 * 60 * 24 * 9);

  //   const completeLaunchMessage2 = new TransactionMessage({
  //     payerKey: this.payer.publicKey,
  //     recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
  //     instructions: completeLaunchTx.instructions,
  //   }).compileToV0Message([completeLaunchLut]);

  //   const tx2 = new VersionedTransaction(completeLaunchMessage2);

  //   tx2.sign([this.payer]);

  //   try {
  //     await this.banksClient.processTransaction(tx2);
  //     assert.fail("Should have thrown error");
  //   } catch (error) {
  //     console.log(error);
  //   }
  // });

  // it("moves to refunding state when minimum raise is not met after period", async function () {
  //   // Fund the launch with less than minimum raise
  //   const partialAmount = minRaise.divn(2);

  //   await launchpadClient.fundIx({ launch, amount: partialAmount }).rpc();

  //   await this.advanceBySeconds(60 * 60 * 24 * 11);

  //   // Complete the launch
  //   const completeLaunchTx = await launchpadClient
  //     .completeLaunchIx({ launch, quoteMint: MAINNET_USDC, baseMint: META })
  //     .transaction();

  //   const completeLaunchLut = await createLookupTableForTransaction(
  //     completeLaunchTx,
  //     this
  //   );

  //   const completeLaunchMessage = new TransactionMessage({
  //     payerKey: this.payer.publicKey,
  //     recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
  //     instructions: completeLaunchTx.instructions,
  //   }).compileToV0Message([completeLaunchLut]);

  //   const tx = new VersionedTransaction(completeLaunchMessage);
  //   tx.sign([this.payer]);

  //   await this.banksClient.processTransaction(tx);

  //   const launchAccount = await launchpadClient.fetchLaunch(launch);

  //   assert.exists(launchAccount.state.refunding);
  // });

  it("fails when launch is in refunding state", async function () {
    // Advance clock past 7 days
    await this.advanceBySeconds(60 * 60 * 24 * 11);

    await launchpadClient.closeLaunchIx({ launch }).rpc();
    // Try to complete again
    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
        launch,
        quoteMint: MAINNET_USDC,
        baseMint: META,
        finalRaiseAmount: minRaise,
        launchAuthority: null,
      })
      .transaction();

    const completeLaunchLut = await createLookupTableForTransaction(
      completeLaunchTx,
      this,
    );

    const completeLaunchMessage2 = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx.instructions,
    }).compileToV0Message([completeLaunchLut]);

    const tx = new VersionedTransaction(completeLaunchMessage2);
    tx.sign([this.payer]);

    const result = await this.banksClient.tryProcessTransaction(tx);
    assert.isTrue(
      result.meta.logMessages.some((log) => log.includes("InvalidLaunchState")),
    );
  });
}
