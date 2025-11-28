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
} from "@metadaoproject/futarchy/v0.6";
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
  let feeRecipient: PublicKey;
  let durationSeconds: number;

  before(async function () {
    futarchyClient = this.futarchy;
    launchpadClient = this.launchpad;
    bidWallClient = this.bidWall;
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad,
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
    await this.launchpad
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

    const launchAccount = await this.launchpad.fetchLaunch(launch);

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
        initialAmmBaseReserves: ammBaseVaultReserves.toNumber(),
        initialAmmQuoteReserves: ammQuoteVaultReserves.toNumber(),
        authority: this.payer.publicKey,
        baseMint: META,
        feeRecipient,
        quoteMint: MAINNET_USDC,
        payer: this.payer.publicKey,
      })
      .rpc();

    const [bidWallAddr] = getBidWallAddr({
      authority: this.payer.publicKey,
      baseMint: META,
    });

    bidWall = bidWallAddr;
  });

  it("successfully sells tokens into a bid wall", async function () {
    const [bidWall] = getBidWallAddr({
      authority: this.payer.publicKey,
      baseMint: META,
    });

    const usdcBalanceBefore = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    const metaBalanceBefore = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );

    // User should have gotten 10M META from the launch
    assert.equal(metaBalanceBefore, 10_000_000_000000n);

    // As it stands:
    // DAO NAV = 100_000_000000 USDC (100K)
    // Active supply = 10_000_000_000010 META (10M + 10)
    // Price = 100_000_000000 / 10_000_000_000010 = ~0.01 USDC per META
    // Assume user sells 5M META
    // User will receive ~50_000 USDC (5M * 0.01) minus 1% fee, rounded down.

    await bidWallClient
      .sellTokensIx({
        amount: 5_000_000_000000,
        bidWall,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        user: this.payer.publicKey,
      })
      .rpc();

    const usdcBalanceAfter = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    const metaBalanceAfter = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );

    // Seller received 49_500_000000 USDC (50K), which is 50_000_000000 - 500_000000 (fee)
    assert.equal(usdcBalanceAfter, usdcBalanceBefore + 49_500_000000n);
    assert.equal(metaBalanceAfter, 5_000_000_000000n);

    // Bid wall collected 500_000000 USDC (0.5K) in fees
    const bidWallAccount = await bidWallClient.fetchBidWall(bidWall);
    assert.equal(
      bidWallAccount.feesCollected.toString(),
      new BN(500_000000).toString(),
    );
  });

  it("fails to sell tokens into a bid wall when bid wall is expired", async function () {
    await this.advanceBySeconds(durationSeconds + 1);

    try {
      await bidWallClient
        .sellTokensIx({
          amount: 5_000_000_000000,
          bidWall,
          baseMint: META,
          quoteMint: MAINNET_USDC,
          user: this.payer.publicKey,
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "BidWallExpired");
    }
  });
}
