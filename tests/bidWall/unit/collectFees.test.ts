import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  FutarchyClient,
  LaunchpadClient,
  BidWallClient,
  MAINNET_USDC,
  getBidWallAddr,
} from "@metadaoproject/futarchy/v0.7";
import { BN } from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { initializeMintWithSeeds } from "../utils.js";
import { createLookupTableForTransaction } from "../../utils.js";

export default function suite() {
  let futarchyClient: FutarchyClient;
  let launchpadClient: LaunchpadClient;
  let bidWallClient: BidWallClient;
  let dao: PublicKey;
  let daoTreasury: PublicKey;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let quoteVault: PublicKey;
  let funderUsdcAccount: PublicKey;
  let secondFunder: Keypair;
  let bidWall: PublicKey;
  let durationSeconds: number;
  let feeRecipient: PublicKey;

  before(async function () {
    futarchyClient = this.futarchy;
    launchpadClient = this.launchpad_v7;
    bidWallClient = this.bidWall;
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

    // Create second funder
    secondFunder = Keypair.generate();
    quoteVault = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      launchSigner,
      true,
    );
    funderUsdcAccount = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    // Initialize launch
    await this.launchpad_v7
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: new BN(100_000 * 10 ** 6), // 100k
        secondsForLaunch: 60 * 60 * 24 * 4, // 4 days
        baseMint: META,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: new BN(10_000 * 10 ** 6), // 15k burn
        monthlySpendingLimitMembers: [this.payer.publicKey],
        performancePackageGrantee: this.payer.publicKey,
        performancePackageTokenAmount: new BN(10), // Effectively no premine
        monthsUntilInsidersCanUnlock: 24, // 2 years
        teamAddress: PublicKey.default,
      })
      .rpc();

    await launchpadClient.startLaunchIx({ launch }).rpc();

    await this.createTokenAccount(META, this.payer.publicKey);

    const fundAmount = new BN(100_000_000000); // 100K USDC

    // Fund the launch
    await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();

    // Advance clock and complete launch
    await this.advanceBySeconds(60 * 60 * 24 * 7 + 100);
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        funder: this.payer.publicKey,
        approvedAmount: fundAmount,
      })
      .rpc();

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
        launch,
        quoteMint: MAINNET_USDC,
        baseMint: META,
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

    const launchAccount = await this.launchpad_v7.fetchLaunch(launch);

    dao = launchAccount.dao;
    daoTreasury = launchAccount.daoVault;

    let ammBaseVaultReserves = new BN(await this.getTokenBalance(META, dao));
    let ammQuoteVaultReserves = new BN(
      await this.getTokenBalance(MAINNET_USDC, dao),
    );

    feeRecipient = Keypair.generate().publicKey;
    await this.createTokenAccount(MAINNET_USDC, feeRecipient);

    // Claim tokens for the payer
    await launchpadClient.claimIx(launch, META).rpc();

    durationSeconds = 100;

    await bidWallClient
      .initializeBidWallIx({
        amount: 100_000_000000,
        durationSeconds,
        initialAmmQuoteReserves: ammQuoteVaultReserves.toNumber(),
        authority: this.payer.publicKey,
        creator: this.payer.publicKey,
        nonce: new BN(0),
        daoTreasury: daoTreasury,
        baseMint: META,
        feeRecipient,
        quoteMint: MAINNET_USDC,
        payer: this.payer.publicKey,
      })
      .rpc();

    const [bidWallAddr] = getBidWallAddr({
      creator: this.payer.publicKey,
      nonce: new BN(0),
      baseMint: META,
    });

    bidWall = bidWallAddr;

    // Sell tokens into bid wall
    await bidWallClient
      .sellTokensIx({
        amount: 5_000_000_000000,
        bidWall,
        baseMint: META,
        daoTreasury: daoTreasury,
        quoteMint: MAINNET_USDC,
        user: this.payer.publicKey,
      })
      .rpc();
  });

  it("successfully collects fees", async function () {
    const feeRecipientUsdcBalanceBefore = await this.getTokenBalance(
      MAINNET_USDC,
      feeRecipient,
    );

    const bidWallUsdcBalanceBefore = await this.getTokenBalance(
      MAINNET_USDC,
      bidWall,
    );

    await bidWallClient
      .collectFeesIx({
        bidWall,
        feeRecipient: feeRecipient,
        quoteMint: MAINNET_USDC,
      })
      .rpc();

    const bidWallUsdcBalanceAfter = await this.getTokenBalance(
      MAINNET_USDC,
      bidWall,
    );

    const feeRecipientUsdcBalanceAfter = await this.getTokenBalance(
      MAINNET_USDC,
      feeRecipient,
    );

    const expectedFeesCollected = 1_000_000000n;

    assert.equal(
      bidWallUsdcBalanceAfter,
      bidWallUsdcBalanceBefore - expectedFeesCollected,
    );
    assert.equal(
      feeRecipientUsdcBalanceAfter,
      feeRecipientUsdcBalanceBefore + expectedFeesCollected,
    );

    const bidWallAccount = await bidWallClient.fetchBidWall(bidWall);
    assert.equal(bidWallAccount.feesCollected.toString(), new BN(0).toString());
  });
}
