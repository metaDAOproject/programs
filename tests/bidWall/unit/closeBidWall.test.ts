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
  MAINNET_METEORA_CONFIG,
  getBidWallAddr,
  getMeteoraPoolAddr,
  getLaunchpadMeteoraPoolPositionAddr,
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
  let METAKP: Keypair;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let quoteVault: PublicKey;
  let funderUsdcAccount: PublicKey;
  let secondFunder: Keypair;
  let bidWall: PublicKey;
  let minDuration: number;
  let feeRecipient: PublicKey;

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

    // // Advance clock and complete launch
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

    minDuration = 100;

    await bidWallClient
      .initializeBidWallIx({
        amount: 100_000_000000,
        minDuration,
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

    const daoTreasuryUsdcTokenAccount = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      daoTreasury,
      true,
    );

    // Sell tokens into bid wall
    await bidWallClient
      .sellTokensIx({
        amount: 5_000_000_000000,
        bidWall,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        user: this.payer.publicKey,
      })
      .rpc();
  });

  it.only("successfully closes a bid wall and receives fees", async function () {
    // Advance clock to past minimum duration plus 1 second
    await this.advanceBySeconds(minDuration + 1);

    const authorityUsdcBalanceBefore = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    const feeWallet = Keypair.generate().publicKey;

    await this.createTokenAccount(MAINNET_USDC, feeWallet);

    const feeWalletUsdcBalanceBefore = await this.getTokenBalance(
      MAINNET_USDC,
      feeWallet,
    );

    await bidWallClient
      .closeBidWallIx({
        bidWall,
        authority: this.payer.publicKey,
        baseMint: META,
        feeRecipient: feeWallet,
        quoteMint: MAINNET_USDC,
        payer: this.payer.publicKey,
      })
      .rpc();

    const bidWallUsdcBalanceAfter = await this.getTokenBalance(
      MAINNET_USDC,
      bidWall,
    );

    const authorityUsdcBalanceAfter = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    const feeWalletUsdcBalanceAfter = await this.getTokenBalance(
      MAINNET_USDC,
      feeWallet,
    );

    assert.equal(bidWallUsdcBalanceAfter, 0n);
    assert.equal(
      authorityUsdcBalanceAfter,
      authorityUsdcBalanceBefore + 50_000_000000n,
    );
    assert.equal(
      feeWalletUsdcBalanceAfter,
      feeWalletUsdcBalanceBefore + 500_000000n,
    );
  });

  it.only("fails to close bid wallwhen bid wall is not expired", async function () {
    try {
      const feeWallet = Keypair.generate().publicKey;

      await this.createTokenAccount(MAINNET_USDC, feeWallet);

      await bidWallClient
        .closeBidWallIx({
          bidWall,
          authority: this.payer.publicKey,
          baseMint: META,
          feeRecipient: feeWallet,
          quoteMint: MAINNET_USDC,
          payer: this.payer.publicKey,
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "BidWallNotExpired");
    }
  });
}
