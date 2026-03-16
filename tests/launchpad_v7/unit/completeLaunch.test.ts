import {
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
} from "@metadaoproject/futarchy/v0.7";
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

    await launchpadClient
      .setFundingRecordApprovalIx({
        approvedAmount: minRaise,
        launch,
        funder: this.payer.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
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
      this.launchpad_v7,
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

    await launchpadClient
      .setFundingRecordApprovalIx({
        approvedAmount: minRaise,
        launch,
        funder: this.payer.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
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

    const daoAccount = await futarchyClient.getDao(launchAccount.dao);
    assert.equal(daoAccount.passThresholdBps, 300);
    assert.equal(daoAccount.teamSponsoredPassThresholdBps, -300);
  });

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
