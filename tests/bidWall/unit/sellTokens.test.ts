import {
  ComputeBudgetProgram,
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
} from "@metadaoproject/programs";
import BN from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { initializeMintWithSeeds } from "../utils.js";
import { createLookupTableForTransaction, expectError } from "../../utils.js";

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
        hasBidWall: false,
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
  });

  it("successfully sells tokens into a bid wall", async function () {
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
    // DAO treasury = 80_000_000000 USDC (100K)
    // Futarchy AMM = 20_000_000000 USDC (20K)
    // Bid wall = 100_000_000000 USDC (100K)
    // Total assumed NAV = 200_000_000000 USDC (200K)
    // Active supply = 10_000_000_000000 META (10M)
    // Price = 200_000_000000 / 10_000_000_000000 = ~0.02 USDC per META
    // Assume user sells 5M META
    // User will receive ~100_000 USDC (5M * 0.02) minus 3% fee, rounded down.

    await bidWallClient
      .sellTokensIx({
        amount: 5_000_000_000000,
        minAmountOut: 97_000_000000, // We should receive exactly 97K USDC
        bidWall,
        baseMint: META,
        daoTreasury: daoTreasury,
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

    // Seller received 97_000_000000 USDC (97K), which is 100_000_000000 - 3_000_000000 (fee)
    assert.equal(usdcBalanceAfter, usdcBalanceBefore + 97_000_000000n);
    assert.equal(metaBalanceAfter, 5_000_000_000000n);

    // Bid wall collected 3_000_000000 USDC (3K) in fees
    const bidWallAccount = await bidWallClient.fetchBidWall(bidWall);
    assert.equal(
      bidWallAccount.feesCollected.toString(),
      new BN(3_000_000000).toString(),
    );
  });

  it("successfully sells tokens at the DAO's updated NAV after treasury balance changes", async function () {
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
    // DAO treasury = 80_000_000000 USDC (100K)
    // Futarchy AMM = 20_000_000000 USDC (20K)
    // Bid wall = 100_000_000000 USDC (100K)
    // Total assumed NAV = 200_000_000000 USDC (200K)
    // Active supply = 10_000_000_000000 META (10M)
    // Price = 200_000_000000 / 10_000_000_000000 = ~0.02 USDC per META
    // Assume user sells 2M META
    // User will receive ~40_000 USDC (2M * 0.02) minus 3% fee, rounded down.

    await bidWallClient
      .sellTokensIx({
        amount: 2_000_000_000000,
        bidWall,
        baseMint: META,
        daoTreasury: daoTreasury,
        quoteMint: MAINNET_USDC,
        user: this.payer.publicKey,
      })
      .rpc();

    const usdcBalanceAfterFirstSell = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    const metaBalanceAfterFirstSell = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );

    // Seller received 38_800_000000 USDC (38.8K), which is 40_000_000000 - 1_200_000000 (fee)
    assert.equal(usdcBalanceAfterFirstSell, usdcBalanceBefore + 38_800_000000n);
    assert.equal(metaBalanceAfterFirstSell, 8_000_000_000000n);

    // Bid wall collected 1_200_000000 USDC (1.2K) in fees
    let bidWallAccount = await bidWallClient.fetchBidWall(bidWall);
    assert.equal(
      bidWallAccount.feesCollected.toString(),
      new BN(1_200_000000).toString(),
    );

    const bidWallUsdcBalanceAfterFirstSell = await this.getTokenBalance(
      MAINNET_USDC,
      bidWall,
    );
    // Bid wall should have 61.2K USDC after the first sell
    // That is 100k (initial bid wall balance) reduced by 40k (bought) plus the fee retained (1.2K)
    assert.equal(bidWallUsdcBalanceAfterFirstSell, 61_200_000000n);

    const daoTreasuryQuoteTokenAccountAddress = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      daoTreasury,
      true,
    );

    // Reduce DAO treasury balance by 60k USDC, bringing it to 20k USDC
    let currentDaoTreasuryQuoteBalance = new BN(
      await this.getTokenBalance(MAINNET_USDC, daoTreasury),
    );

    const daoTreasuryQuoteTokenAccount = await this.banksClient.getAccount(
      daoTreasuryQuoteTokenAccountAddress,
    );
    daoTreasuryQuoteTokenAccount.data.set(
      currentDaoTreasuryQuoteBalance
        .sub(new BN(60_000_000000))
        .toArrayLike(Buffer, "le", 8),
      64, // Amount is at offset 64
    );

    this.context.setAccount(
      daoTreasuryQuoteTokenAccountAddress,
      daoTreasuryQuoteTokenAccount,
    );

    currentDaoTreasuryQuoteBalance = new BN(
      await this.getTokenBalance(MAINNET_USDC, daoTreasury),
    );

    assert.equal(
      currentDaoTreasuryQuoteBalance.toString(),
      new BN(20_000_000000).toString(),
    );

    // NAV is now:
    // DAO treasury = 20_000_000000 USDC (20K)
    // Futarchy AMM = 20_000_000000 USDC (20K)
    // Bid wall = 60_000_000000 USDC (60K)
    // Total assumed NAV = 100_000_000000 USDC (100K)
    // Active supply = 8_000_000_000000 META (8M)
    // Price = 100_000_000000 / 8_000_000_000000 = ~0.0125 USDC per META
    // Assume user sells 2M META
    // User will receive 24_250 USDC, which is 25_000 USDC (2M * 0.0125) minus 3% fee (750 USDC), rounded down.

    await bidWallClient
      .sellTokensIx({
        amount: 2_000_000_000000,
        bidWall,
        baseMint: META,
        daoTreasury: daoTreasury,
        quoteMint: MAINNET_USDC,
        user: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .rpc();

    const usdcBalanceAfterSecondSell = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );
    const metaBalanceAfterSecondSell = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );
    assert.equal(
      usdcBalanceAfterSecondSell,
      usdcBalanceAfterFirstSell + 24_250_000000n,
    );
    assert.equal(metaBalanceAfterSecondSell, 6_000_000_000000n);

    // Bid wall collected an additional 750_000000 USDC (750) in fees, totalling 1.95K USDC
    bidWallAccount = await bidWallClient.fetchBidWall(bidWall);
    assert.equal(
      bidWallAccount.feesCollected.toString(),
      new BN(1_950_000000).toString(),
    );

    const bidWallUsdcBalanceAfterSecondSell = await this.getTokenBalance(
      MAINNET_USDC,
      bidWall,
    );
    // Bid wall should have 36_950 USDC after the second sell
    // That is 61_200 (after first sell) reduced by 25_000 (bought) plus the fee retained (750)
    assert.equal(bidWallUsdcBalanceAfterSecondSell, 36_950_000000n);

    // Confirm that a third sell would get the same price per token as the second sell
    await bidWallClient
      .sellTokensIx({
        amount: 2_000_000_000000,
        bidWall,
        baseMint: META,
        daoTreasury: daoTreasury,
        quoteMint: MAINNET_USDC,
        user: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_002 }),
      ])
      .rpc();

    const usdcBalanceAfterThirdSell = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );
    const metaBalanceAfterThirdSell = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );
    assert.equal(
      usdcBalanceAfterThirdSell,
      usdcBalanceAfterSecondSell + 24_250_000000n,
    );
    assert.equal(metaBalanceAfterThirdSell, 4_000_000_000000n);

    // Bid wall collected an additional 750 USDC in fees, totalling 2.7K USDC
    bidWallAccount = await bidWallClient.fetchBidWall(bidWall);
    assert.equal(
      bidWallAccount.feesCollected.toString(),
      new BN(2_700_000000).toString(),
    );

    const bidWallUsdcBalanceAfterThirdSell = await this.getTokenBalance(
      MAINNET_USDC,
      bidWall,
    );
    // Bid wall should have 12_700 USDC after the third sell
    // That is 36_950 (after second sell) reduced by 25_000 (bought) plus the fee retained (750)
    assert.equal(bidWallUsdcBalanceAfterThirdSell, 12_700_000000n);
  });

  it("fails to sell tokens into a bid wall when the output amount is less than the minimum output amount", async function () {
    const callbacks = expectError(
      "InsufficientOutputAmount",
      "bid wall should fail to sell tokens when the output amount is less than the minimum output amount",
    );

    await bidWallClient
      .sellTokensIx({
        amount: 5_000_000_000000,
        minAmountOut: 100_000_000000,
        bidWall,
        baseMint: META,
        daoTreasury: daoTreasury,
        quoteMint: MAINNET_USDC,
        user: this.payer.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("sending quote tokens to a bid wall beyond what was originally allocated doesn't change the NAV per token", async function () {
    // Send 1M USDC to the bid wall
    await this.transfer(MAINNET_USDC, this.payer, bidWall, 1_000_000_000000);

    const usdcBalanceBefore = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );

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

    const usdcBalanceAfter = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    // User received 97_000_000000 USDC (97K), which is 100_000_000000 - 3_000_000000 (fee)
    // This is the same case as in the "successfully sells tokens into a bid wall" test
    // Bid wall remains unaffected by the transfer of USDC into it
    assert.equal(usdcBalanceAfter, usdcBalanceBefore + 97_000_000000n);
  });

  it("fails to sell tokens into a bid wall when bid wall is expired", async function () {
    await this.advanceBySeconds(durationSeconds + 1);

    try {
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
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "BidWallExpired");
    }
  });

  it("fails to sell tokens into a bid wall beyond what was originally allocated to the bid wall", async function () {
    try {
      await bidWallClient
        .sellTokensIx({
          amount: 5_000_001_000000,
          bidWall,
          baseMint: META,
          daoTreasury: daoTreasury,
          quoteMint: MAINNET_USDC,
          user: this.payer.publicKey,
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InsufficientQuoteReserves");
    }
  });

  it("fails to sell tokens into a bid wall when the bid wall is depleted", async function () {
    // Deplete the bid wall
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

    try {
      await bidWallClient
        .sellTokensIx({
          amount: 1,
          bidWall,
          baseMint: META,
          daoTreasury: daoTreasury,
          quoteMint: MAINNET_USDC,
          user: this.payer.publicKey,
        })
        .rpc();

      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "BidWallDepleted");
    }
  });

  it("fails to sell tokens into a bid wall when the input amount is 0", async function () {
    try {
      await bidWallClient
        .sellTokensIx({
          amount: 0,
          bidWall,
          baseMint: META,
          daoTreasury: daoTreasury,
          quoteMint: MAINNET_USDC,
          user: this.payer.publicKey,
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InvalidInputAmount");
    }
  });

  it("fails to sell tokens into a bid wall when the input amount would result in a zero output amount", async function () {
    const callbacks = expectError(
      "InsufficientOutputAmount",
      "bid wall should fail to sell tokens when the input amount would result in a zero output amount",
    );

    await bidWallClient
      .sellTokensIx({
        amount: 1,
        bidWall,
        baseMint: META,
        daoTreasury: daoTreasury,
        quoteMint: MAINNET_USDC,
        user: this.payer.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
