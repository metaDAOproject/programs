import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";
import { BankrunProvider } from "anchor-bankrun";
import { BanksClient } from "solana-bankrun";
import {
  FutarchyClient,
  getDaoAddr,
  MAINNET_USDC,
  parseWhirlpool,
  RelaunchClient,
  USDC_SWAP_POOL,
} from "@metadaoproject/programs";
import {
  setupRelaunch,
  RelaunchSetup,
  DEFAULT_OLD_SUPPLY,
} from "../relaunch/utils.js";
import { writePumpPool } from "../relaunch/pumpAmm.js";
import { writeRaydiumPool } from "../relaunch/raydiumAmm.js";
import {
  ensureWhirlpool,
  WhirlpoolFixture,
  wrapSol,
} from "../relaunch/whirlpool.js";

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
// Small enough that the sell proceeds (~5 SOL) swap through the whirlpool
// fixture (1000 SOL / 100k USDC) with well under 1% price impact.
const WSOL_POOL_QUOTE_RESERVE = 5n * 10n ** 9n; // 5 SOL
const USDC_POOL_QUOTE_RESERVE = 100_000n * 10n ** 6n; // 100k USDC

const TOKENS_TO_DEPOSITORS = 12_500_000n * 10n ** 6n;
const TOKENS_TO_FUTARCHY_LIQUIDITY = 12_500_000n * 10n ** 6n;
const PRICE_SCALE = 10n ** 12n;

const ONE_WEEK = 60 * 60 * 24 * 7;
const ONE_DAY = 60 * 60 * 24;

// 10% of the 1B-token default supply = 100M tokens.
const THRESHOLD_BPS = 1000;
const THRESHOLD_AMOUNT = DEFAULT_OLD_SUPPLY / 10n;

// The happy-path deposits: 60M + 39.99M direct plus 10k bought lands exactly
// on the 100M threshold and splits the 10M depositor bucket into
// 6M / 3.999M / 1k with zero dust.
const ALICE_DEPOSIT = 60_000_000n * 10n ** 6n;
const BOB_DEPOSIT = 39_990_000n * 10n ** 6n;
const BUY_DEPOSIT = 10_000n * 10n ** 6n;

async function tokenBalance(
  banksClient: BanksClient,
  address: PublicKey,
  tokenProgram: PublicKey = token.TOKEN_PROGRAM_ID,
): Promise<bigint> {
  const raw = await banksClient.getAccount(address);
  if (!raw) return 0n;
  return token.unpackAccount(
    address,
    { ...raw, data: Buffer.from(raw.data) } as any,
    tokenProgram,
  ).amount;
}

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

// Raydium AMM v4 money math at its flat 25 bps fee, which stays in the pool.
// The exact input pulled for an exact-output buy: the constant-product input,
// ceil-rounded, with the fee ceil-rounded on top of it.
function raydiumBuyIn(
  amountOut: bigint,
  quoteReserve: bigint,
  tokenReserve: bigint,
): bigint {
  const inBeforeFee = ceilDiv(
    quoteReserve * amountOut,
    tokenReserve - amountOut,
  );
  return ceilDiv(inBeforeFee * 10_000n, 9_975n);
}

// The exact output of an exact-in sell: the fee is ceil-rounded off the
// input, the remainder swaps at constant product.
function raydiumSellOut(
  amountIn: bigint,
  tokenReserve: bigint,
  quoteReserve: bigint,
): bigint {
  const net = amountIn - ceilDiv(amountIn * 25n, 10_000n);
  return (quoteReserve * net) / (tokenReserve + net);
}

export default function suite() {
  let client: RelaunchClient;
  let futarchyClient: FutarchyClient;
  let whirlpool: WhirlpoolFixture;

  before(async function () {
    // Created here rather than taken from the context so the suite also runs
    // standalone, without the relaunch unit suites' before hook.
    const provider = new BankrunProvider(this.context);
    client = RelaunchClient.createClient({ provider: provider as any });
    futarchyClient = this.futarchy;
    whirlpool = await ensureWhirlpool({
      provider: provider as any,
      payer: this.payer,
      banksClient: this.banksClient,
    });
  });

  const initializeLiveRelaunch = async function (
    this: Mocha.Context,
    {
      quoteMint,
      oldTokenProgram,
    }: { quoteMint: PublicKey; oldTokenProgram: PublicKey },
  ) {
    const setup = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
      oldTokenProgram,
    });
    const pool = await writePumpPool({
      context: this.context,
      baseMint: setup.oldMint,
      quoteMint,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: quoteMint.equals(token.NATIVE_MINT)
        ? WSOL_POOL_QUOTE_RESERVE
        : USDC_POOL_QUOTE_RESERVE,
      baseTokenProgram: oldTokenProgram,
    });

    const { relaunch, newMint } = await client.initializeRelaunch({
      oldMint: setup.oldMint,
      sourcePool: pool.pool,
      sourceQuoteMint: quoteMint,
      tokenName: "Relaunched",
      tokenSymbol: "RLNCH",
      tokenUri: "https://example.com/rlnch.json",
      secondsForDeposits: ONE_WEEK,
      gracePeriodSeconds: ONE_DAY,
      thresholdBps: THRESHOLD_BPS,
      teamAddress: this.payer.publicKey,
    });

    await client.startDepositsIx({ relaunch }).rpc();

    return { setup, pool, relaunch, newMint };
  };

  // Raydium sources are WSOL-quoted classic-SPL by construction, so unlike
  // the pump helper there is no matrix to parameterize.
  const initializeLiveRaydiumRelaunch = async function (this: Mocha.Context) {
    const setup = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
    });
    const pool = writeRaydiumPool({
      context: this.context,
      oldMint: setup.oldMint,
      tokenReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
    });

    const { relaunch, newMint } = await client.initializeRelaunch({
      oldMint: setup.oldMint,
      sourcePool: pool.pool,
      sourceQuoteMint: token.NATIVE_MINT,
      tokenName: "Relaunched",
      tokenSymbol: "RLNCH",
      tokenUri: "https://example.com/rlnch.json",
      secondsForDeposits: ONE_WEEK,
      gracePeriodSeconds: ONE_DAY,
      thresholdBps: THRESHOLD_BPS,
      teamAddress: this.payer.publicKey,
    });

    await client.startDepositsIx({ relaunch }).rpc();

    return { setup, pool, relaunch, newMint };
  };

  // Creates the depositor's ATA and funds it with old tokens from the payer.
  const fundDepositor = async function (
    this: Mocha.Context,
    { oldMint, oldTokenProgram, payerOldTokenAccount }: RelaunchSetup,
    depositor: PublicKey,
    amount: bigint,
  ): Promise<PublicKey> {
    const ata = token.getAssociatedTokenAddressSync(
      oldMint,
      depositor,
      false,
      oldTokenProgram,
    );
    const tx = new Transaction().add(
      token.createAssociatedTokenAccountIdempotentInstruction(
        this.payer.publicKey,
        ata,
        depositor,
        oldMint,
        oldTokenProgram,
      ),
      token.createTransferCheckedInstruction(
        payerOldTokenAccount,
        oldMint,
        ata,
        this.payer.publicKey,
        amount,
        6,
        [],
        oldTokenProgram,
      ),
    );
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer);
    await this.banksClient.processTransaction(tx);
    return ata;
  };

  const deposit = async function (
    this: Mocha.Context,
    relaunch: PublicKey,
    { oldMint, oldTokenProgram }: RelaunchSetup,
    amount: bigint,
    depositor?: Keypair,
  ) {
    const builder = client.depositIx({
      relaunch,
      oldMint,
      oldTokenProgram,
      amount: new BN(amount.toString()),
      depositor: depositor?.publicKey,
    });
    if (depositor !== undefined) {
      builder.signers([depositor]);
    }
    await builder.rpc();
  };

  // Drives a sold relaunch through the venue-invariant tail — the Orca leg
  // for WSOL-quoted sources, completion, and the pro-rata claims — asserting
  // identities that hold for every source venue.
  const runCompletionTail = async function (
    this: Mocha.Context,
    {
      relaunch,
      newMint,
      alice,
      bob,
      isWsol,
    }: {
      relaunch: PublicKey;
      newMint: PublicKey;
      alice: Keypair;
      bob: Keypair;
      isWsol: boolean;
    },
  ) {
    let stored = await client.fetchRelaunch(relaunch);
    const quoteRecovered = BigInt(stored.quoteRecovered.toString());

    if (isWsol) {
      assert.isDefined(stored.state.sold);
      assert.equal(stored.usdcRecovered.toString(), "0");
      assert.equal(
        (
          await tokenBalance(this.banksClient, stored.sourceQuoteVault)
        ).toString(),
        quoteRecovered.toString(),
      );

      const whirlpoolState = parseWhirlpool(
        Buffer.from((await this.banksClient.getAccount(USDC_SWAP_POOL))!.data),
      );
      // Spot price in USDC-raw per WSOL-raw is (sqrtPrice / 2^64)^2.
      const spotUsdcOut =
        (quoteRecovered *
          whirlpoolState.sqrtPrice *
          whirlpoolState.sqrtPrice) >>
        128n;
      const whirlpoolWsolBefore = await tokenBalance(
        this.banksClient,
        whirlpool.tokenVaultA,
      );
      const whirlpoolUsdcBefore = await tokenBalance(
        this.banksClient,
        whirlpool.tokenVaultB,
      );

      await client.executeUsdcSwap({ relaunch });

      stored = await client.fetchRelaunch(relaunch);
      assert.equal(stored.quoteRecovered.toString(), quoteRecovered.toString());
      assert.equal(
        (
          await tokenBalance(this.banksClient, stored.sourceQuoteVault)
        ).toString(),
        "0",
      );

      // The full WSOL proceeds went into the whirlpool, every USDC it paid
      // out landed in the relaunch's vault, and the output sits at spot
      // minus the fee and a little price impact.
      const usdcRecovered = BigInt(stored.usdcRecovered.toString());
      assert.equal(
        (
          (await tokenBalance(this.banksClient, whirlpool.tokenVaultA)) -
          whirlpoolWsolBefore
        ).toString(),
        quoteRecovered.toString(),
      );
      assert.equal(
        (
          whirlpoolUsdcBefore -
          (await tokenBalance(this.banksClient, whirlpool.tokenVaultB))
        ).toString(),
        usdcRecovered.toString(),
      );
      assert.isTrue(usdcRecovered > (spotUsdcOut * 97n) / 100n);
      assert.isTrue(usdcRecovered <= spotUsdcOut);
    } else {
      // USDC-quoted sources share one vault for quote and USDC and jump
      // straight to Swapped.
      assert.ok(stored.sourceQuoteVault.equals(stored.usdcVault));
      assert.equal(stored.usdcRecovered.toString(), quoteRecovered.toString());
    }

    assert.isDefined(stored.state.swapped);
    const usdcRecovered = BigInt(stored.usdcRecovered.toString());
    assert.equal(
      (await tokenBalance(this.banksClient, stored.usdcVault)).toString(),
      usdcRecovered.toString(),
    );

    await client.completeRelaunch({ relaunch });

    stored = await client.fetchRelaunch(relaunch);
    assert.isDefined(stored.state.complete);

    const relaunchSigner = client.getRelaunchSignerAddress({ relaunch });
    const [dao] = getDaoAddr({ nonce: new BN(0), daoCreator: relaunchSigner });
    assert.ok(stored.dao.equals(dao));

    const storedDao = await futarchyClient.getDao(dao);
    assert.ok(storedDao.baseMint.equals(newMint));
    assert.ok(storedDao.quoteMint.equals(MAINNET_USDC));

    // Price identity: the TWAP opens at the raise valued over the liquidity
    // bucket, and the AMM opens at exactly that ratio — the full 12.5M
    // liquidity bucket against the whole raise.
    const expectedTwap =
      (usdcRecovered * PRICE_SCALE) / TOKENS_TO_FUTARCHY_LIQUIDITY;
    assert.equal(
      storedDao.twapInitialObservation.toString(),
      expectedTwap.toString(),
    );
    assert.equal(
      storedDao.twapMaxObservationChangePerUpdate.toString(),
      (expectedTwap / 20n).toString(),
    );

    const spot = storedDao.amm.state.spot.spot;
    const baseReserves = BigInt(spot.baseReserves.toString());
    const quoteReserves = BigInt(spot.quoteReserves.toString());
    assert.equal(
      baseReserves.toString(),
      TOKENS_TO_FUTARCHY_LIQUIDITY.toString(),
    );
    assert.equal(quoteReserves.toString(), usdcRecovered.toString());
    assert.equal(
      ((quoteReserves * PRICE_SCALE) / baseReserves).toString(),
      expectedTwap.toString(),
    );

    // The whole raise seeds the AMM; the Squads vault gets no USDC.
    const treasuryBalance = await tokenBalance(
      this.banksClient,
      token.getAssociatedTokenAddressSync(MAINNET_USDC, stored.daoVault, true),
    );
    assert.equal(treasuryBalance.toString(), "0");
    assert.equal(
      (await tokenBalance(this.banksClient, stored.usdcVault)).toString(),
      "0",
    );

    assert.equal(
      (await tokenBalance(this.banksClient, stored.newTokenVault)).toString(),
      TOKENS_TO_DEPOSITORS.toString(),
    );
    const mint = await this.getMint(newMint);
    assert.ok(mint.mintAuthority.equals(stored.daoVault));

    // Claims: 12.5M × 60M/100M, 12.5M × 39.99M/100M, 12.5M × 10k/100M —
    // every share divides exactly, so the vault empties with zero dust.
    await client
      .claimIx({ relaunch, newMint, depositor: alice.publicKey })
      .rpc();
    await client.claimIx({ relaunch, newMint, depositor: bob.publicKey }).rpc();
    await client.claimIx({ relaunch, newMint }).rpc();

    const expectedClaims: [PublicKey, bigint][] = [
      [alice.publicKey, 7_500_000n * 10n ** 6n],
      [bob.publicKey, 4_998_750n * 10n ** 6n],
      [this.payer.publicKey, 1_250n * 10n ** 6n],
    ];
    for (const [owner, amount] of expectedClaims) {
      assert.equal(
        (
          await tokenBalance(
            this.banksClient,
            token.getAssociatedTokenAddressSync(newMint, owner),
          )
        ).toString(),
        amount.toString(),
      );
      const record = await client.getDepositRecord({
        relaunch,
        depositor: owner,
      });
      assert.isTrue(record.claimed);
    }
    assert.equal(
      (await tokenBalance(this.banksClient, stored.newTokenVault)).toString(),
      "0",
    );

    // Every hop emitted exactly one event: start, three deposits, close,
    // sell, (the USDC swap,) complete, three claims.
    stored = await client.fetchRelaunch(relaunch);
    assert.equal(stored.seqNum.toString(), isWsol ? "11" : "10");
  };

  const runHappyPath = async function (
    this: Mocha.Context,
    {
      quoteMint,
      oldTokenProgram,
    }: { quoteMint: PublicKey; oldTokenProgram: PublicKey },
  ) {
    const isWsol = quoteMint.equals(token.NATIVE_MINT);
    const { setup, pool, relaunch, newMint } =
      await initializeLiveRelaunch.call(this, { quoteMint, oldTokenProgram });

    let stored = await client.fetchRelaunch(relaunch);
    assert.isDefined(stored.state.live);
    assert.equal(
      stored.oldSupplySnapshot.toString(),
      DEFAULT_OLD_SUPPLY.toString(),
    );
    assert.equal(
      (await tokenBalance(this.banksClient, stored.newTokenVault)).toString(),
      (TOKENS_TO_DEPOSITORS + TOKENS_TO_FUTARCHY_LIQUIDITY).toString(),
    );

    // Mixed entry: two direct depositors interleaved with a bought deposit.
    const alice = Keypair.generate();
    const bob = Keypair.generate();
    await fundDepositor.call(this, setup, alice.publicKey, ALICE_DEPOSIT);
    await fundDepositor.call(this, setup, bob.publicKey, BOB_DEPOSIT);

    await deposit.call(this, relaunch, setup, ALICE_DEPOSIT, alice);
    await client.depositViaBuy({
      relaunch,
      baseOut: new BN(BUY_DEPOSIT.toString()),
      maxQuoteIn: new BN((isWsol ? 10n ** 9n : 2_000n * 10n ** 6n).toString()),
    });
    await deposit.call(this, relaunch, setup, BOB_DEPOSIT, bob);

    stored = await client.fetchRelaunch(relaunch);
    assert.equal(stored.totalDeposited.toString(), THRESHOLD_AMOUNT.toString());
    assert.equal(
      (
        await tokenBalance(
          this.banksClient,
          stored.oldTokenVault,
          oldTokenProgram,
        )
      ).toString(),
      THRESHOLD_AMOUNT.toString(),
    );
    const expectedDeposits: [PublicKey, bigint][] = [
      [alice.publicKey, ALICE_DEPOSIT],
      [bob.publicKey, BOB_DEPOSIT],
      [this.payer.publicKey, BUY_DEPOSIT],
    ];
    for (const [depositor, amount] of expectedDeposits) {
      const record = await client.getDepositRecord({ relaunch, depositor });
      assert.equal(record.amountDeposited.toString(), amount.toString());
    }

    // The deposits land exactly on the threshold, so closing moves to
    // SellPending.
    await this.advanceBySeconds(ONE_WEEK);
    await client.closeDepositsIx({ relaunch }).rpc();
    stored = await client.fetchRelaunch(relaunch);
    assert.isDefined(stored.state.sellPending);

    const poolBaseBefore = await tokenBalance(
      this.banksClient,
      pool.poolBaseTokenAccount,
      oldTokenProgram,
    );
    const poolQuoteBefore = await tokenBalance(
      this.banksClient,
      pool.poolQuoteTokenAccount,
    );

    // 100 bps of slippage can exactly match pump's fee, leaving no rounding
    // margin; give the sell floor explicit headroom.
    await client.executeSell({ relaunch, slippageBps: 200 });

    stored = await client.fetchRelaunch(relaunch);
    const quoteRecovered = BigInt(stored.quoteRecovered.toString());
    assert.equal(
      (
        await tokenBalance(
          this.banksClient,
          stored.oldTokenVault,
          oldTokenProgram,
        )
      ).toString(),
      "0",
    );
    assert.equal(
      (
        await tokenBalance(
          this.banksClient,
          pool.poolBaseTokenAccount,
          oldTokenProgram,
        )
      ).toString(),
      (poolBaseBefore + THRESHOLD_AMOUNT).toString(),
    );

    // The proceeds are the constant-product output minus pump's fees.
    const grossQuoteOut =
      (poolQuoteBefore * THRESHOLD_AMOUNT) /
      (poolBaseBefore + THRESHOLD_AMOUNT);
    assert.isTrue(quoteRecovered > (grossQuoteOut * 97n) / 100n);
    assert.isTrue(quoteRecovered <= grossQuoteOut);

    await runCompletionTail.call(this, {
      relaunch,
      newMint,
      alice,
      bob,
      isWsol,
    });
  };

  describe("happy path", function () {
    it("relaunches a classic-SPL token from a WSOL-quoted pool", async function () {
      await runHappyPath.call(this, {
        quoteMint: token.NATIVE_MINT,
        oldTokenProgram: token.TOKEN_PROGRAM_ID,
      });
    });

    it("relaunches a Token-2022 token from a WSOL-quoted pool", async function () {
      await runHappyPath.call(this, {
        quoteMint: token.NATIVE_MINT,
        oldTokenProgram: token.TOKEN_2022_PROGRAM_ID,
      });
    });

    it("relaunches a classic-SPL token from a USDC-quoted pool", async function () {
      await runHappyPath.call(this, {
        quoteMint: MAINNET_USDC,
        oldTokenProgram: token.TOKEN_PROGRAM_ID,
      });
    });

    it("relaunches a Token-2022 token from a USDC-quoted pool", async function () {
      await runHappyPath.call(this, {
        quoteMint: MAINNET_USDC,
        oldTokenProgram: token.TOKEN_2022_PROGRAM_ID,
      });
    });
  });

  // Two direct depositors and a bought deposit that together miss the
  // threshold, then exact refunds for all three — buy-credited tokens refund
  // as old tokens just like direct ones, whatever the source venue.
  const runThresholdMiss = async function (
    this: Mocha.Context,
    { setup, relaunch }: { setup: RelaunchSetup; relaunch: PublicKey },
  ) {
    const alice = Keypair.generate();
    const bob = Keypair.generate();
    const aliceDeposit = 30_000_000n * 10n ** 6n;
    const bobDeposit = 20_000_000n * 10n ** 6n;
    const aliceAta = await fundDepositor.call(
      this,
      setup,
      alice.publicKey,
      aliceDeposit,
    );
    const bobAta = await fundDepositor.call(
      this,
      setup,
      bob.publicKey,
      bobDeposit,
    );

    await deposit.call(this, relaunch, setup, aliceDeposit, alice);
    await client.depositViaBuy({
      relaunch,
      baseOut: new BN(BUY_DEPOSIT.toString()),
      maxQuoteIn: new BN((10n ** 9n).toString()),
    });
    await deposit.call(this, relaunch, setup, bobDeposit, bob);

    // 50.01M of the 100M threshold, so closing lands in Failed.
    await this.advanceBySeconds(ONE_WEEK);
    await client.closeDepositsIx({ relaunch }).rpc();

    const stored = await client.fetchRelaunch(relaunch);
    assert.isDefined(stored.state.failed);
    const totalDeposited = aliceDeposit + bobDeposit + BUY_DEPOSIT;
    assert.equal(stored.totalDeposited.toString(), totalDeposited.toString());
    assert.equal(
      (await tokenBalance(this.banksClient, stored.oldTokenVault)).toString(),
      totalDeposited.toString(),
    );

    const payerBefore = await tokenBalance(
      this.banksClient,
      setup.payerOldTokenAccount,
    );

    await client.claimRefund({ relaunch, depositor: alice.publicKey });
    await client.claimRefund({ relaunch, depositor: bob.publicKey });
    await client.claimRefund({ relaunch });

    assert.equal(
      (await tokenBalance(this.banksClient, aliceAta)).toString(),
      aliceDeposit.toString(),
    );
    assert.equal(
      (await tokenBalance(this.banksClient, bobAta)).toString(),
      bobDeposit.toString(),
    );
    // The buy is not unwound — the bought tokens refund as old tokens on
    // top of what the payer held.
    assert.equal(
      (
        (await tokenBalance(this.banksClient, setup.payerOldTokenAccount)) -
        payerBefore
      ).toString(),
      BUY_DEPOSIT.toString(),
    );
    assert.equal(
      (await tokenBalance(this.banksClient, stored.oldTokenVault)).toString(),
      "0",
    );
  };

  it("misses the threshold and refunds every deposit exactly", async function () {
    const { setup, relaunch } = await initializeLiveRelaunch.call(this, {
      quoteMint: token.NATIVE_MINT,
      oldTokenProgram: token.TOKEN_PROGRAM_ID,
    });
    await runThresholdMiss.call(this, { setup, relaunch });
  });

  it("marks a stalled sell Failed after the grace period and refunds exactly", async function () {
    const { setup, relaunch } = await initializeLiveRelaunch.call(this, {
      quoteMint: MAINNET_USDC,
      oldTokenProgram: token.TOKEN_2022_PROGRAM_ID,
    });

    const alice = Keypair.generate();
    const aliceDeposit = 60_000_000n * 10n ** 6n;
    const payerDeposit = 40_000_000n * 10n ** 6n;
    const aliceAta = await fundDepositor.call(
      this,
      setup,
      alice.publicKey,
      aliceDeposit,
    );

    await deposit.call(this, relaunch, setup, aliceDeposit, alice);
    await deposit.call(this, relaunch, setup, payerDeposit);

    // The threshold is met, so closing lands in SellPending — but the admin
    // never sells.
    await this.advanceBySeconds(ONE_WEEK);
    await client.closeDepositsIx({ relaunch }).rpc();
    let stored = await client.fetchRelaunch(relaunch);
    assert.isDefined(stored.state.sellPending);

    await this.advanceBySeconds(ONE_DAY + 1);
    await client.markFailedIx({ relaunch }).rpc();
    stored = await client.fetchRelaunch(relaunch);
    assert.isDefined(stored.state.failed);

    const payerBefore = await tokenBalance(
      this.banksClient,
      setup.payerOldTokenAccount,
      token.TOKEN_2022_PROGRAM_ID,
    );

    await client.claimRefund({ relaunch, depositor: alice.publicKey });
    await client.claimRefund({ relaunch });

    assert.equal(
      (
        await tokenBalance(
          this.banksClient,
          aliceAta,
          token.TOKEN_2022_PROGRAM_ID,
        )
      ).toString(),
      aliceDeposit.toString(),
    );
    assert.equal(
      (
        (await tokenBalance(
          this.banksClient,
          setup.payerOldTokenAccount,
          token.TOKEN_2022_PROGRAM_ID,
        )) - payerBefore
      ).toString(),
      payerDeposit.toString(),
    );
    assert.equal(
      (
        await tokenBalance(
          this.banksClient,
          stored.oldTokenVault,
          token.TOKEN_2022_PROGRAM_ID,
        )
      ).toString(),
      "0",
    );
  });

  describe("Raydium source", function () {
    it("relaunches through an AMM v4 pool with exact money math at each hop", async function () {
      const { setup, pool, relaunch, newMint } =
        await initializeLiveRaydiumRelaunch.call(this);

      let stored = await client.fetchRelaunch(relaunch);
      assert.isDefined(stored.state.live);
      assert.isDefined(stored.sourceVenue.raydiumAmmV4);
      assert.equal(
        stored.oldSupplySnapshot.toString(),
        DEFAULT_OLD_SUPPLY.toString(),
      );
      assert.equal(
        (await tokenBalance(this.banksClient, stored.newTokenVault)).toString(),
        (TOKENS_TO_DEPOSITORS + TOKENS_TO_FUTARCHY_LIQUIDITY).toString(),
      );

      // Mixed entry: two direct depositors interleaved with a bought deposit.
      const alice = Keypair.generate();
      const bob = Keypair.generate();
      await fundDepositor.call(this, setup, alice.publicKey, ALICE_DEPOSIT);
      await fundDepositor.call(this, setup, bob.publicKey, BOB_DEPOSIT);

      await deposit.call(this, relaunch, setup, ALICE_DEPOSIT, alice);

      // Pre-fund the WSOL ATA past max_quote_in so no shortfall wrap runs
      // and the buy's spend is a clean delta.
      const wsolAta = await wrapSol(client.provider, this.payer, 10n ** 9n);
      const wsolBefore = await tokenBalance(this.banksClient, wsolAta);
      await client.depositViaBuy({
        relaunch,
        baseOut: new BN(BUY_DEPOSIT.toString()),
        maxQuoteIn: new BN((10n ** 9n).toString()),
      });

      // Buy identity: the CPI pulled exactly the exact-out input from the
      // depositor, and the full input (fee included) landed in the pool.
      // Default orientation puts the token on the pc side, WSOL on coin.
      const buyIn = raydiumBuyIn(
        BUY_DEPOSIT,
        WSOL_POOL_QUOTE_RESERVE,
        POOL_BASE_RESERVE,
      );
      assert.equal(
        (
          wsolBefore - (await tokenBalance(this.banksClient, wsolAta))
        ).toString(),
        buyIn.toString(),
      );
      assert.equal(
        (await tokenBalance(this.banksClient, pool.pcVault)).toString(),
        (POOL_BASE_RESERVE - BUY_DEPOSIT).toString(),
      );
      assert.equal(
        (await tokenBalance(this.banksClient, pool.coinVault)).toString(),
        (WSOL_POOL_QUOTE_RESERVE + buyIn).toString(),
      );

      await deposit.call(this, relaunch, setup, BOB_DEPOSIT, bob);

      stored = await client.fetchRelaunch(relaunch);
      assert.equal(
        stored.totalDeposited.toString(),
        THRESHOLD_AMOUNT.toString(),
      );
      assert.equal(
        (await tokenBalance(this.banksClient, stored.oldTokenVault)).toString(),
        THRESHOLD_AMOUNT.toString(),
      );
      const expectedDeposits: [PublicKey, bigint][] = [
        [alice.publicKey, ALICE_DEPOSIT],
        [bob.publicKey, BOB_DEPOSIT],
        [this.payer.publicKey, BUY_DEPOSIT],
      ];
      for (const [depositor, amount] of expectedDeposits) {
        const record = await client.getDepositRecord({ relaunch, depositor });
        assert.equal(record.amountDeposited.toString(), amount.toString());
      }

      // The deposits land exactly on the threshold, so closing moves to
      // SellPending.
      await this.advanceBySeconds(ONE_WEEK);
      await client.closeDepositsIx({ relaunch }).rpc();
      stored = await client.fetchRelaunch(relaunch);
      assert.isDefined(stored.state.sellPending);

      // Raydium's flat 25 bps fee is modeled exactly, so the SDK's default
      // slippage floor needs no fee headroom.
      await client.executeSell({ relaunch });

      // Sell identity: the whole vault sold off the buy-shifted reserves at
      // the exact constant-product output, fee left in the pool.
      const sellTokenReserve = POOL_BASE_RESERVE - BUY_DEPOSIT;
      const sellQuoteReserve = WSOL_POOL_QUOTE_RESERVE + buyIn;
      const predictedOut = raydiumSellOut(
        THRESHOLD_AMOUNT,
        sellTokenReserve,
        sellQuoteReserve,
      );
      stored = await client.fetchRelaunch(relaunch);
      assert.equal(stored.quoteRecovered.toString(), predictedOut.toString());
      assert.equal(
        (await tokenBalance(this.banksClient, stored.oldTokenVault)).toString(),
        "0",
      );
      assert.equal(
        (await tokenBalance(this.banksClient, pool.pcVault)).toString(),
        (sellTokenReserve + THRESHOLD_AMOUNT).toString(),
      );
      assert.equal(
        (await tokenBalance(this.banksClient, pool.coinVault)).toString(),
        (sellQuoteReserve - predictedOut).toString(),
      );

      await runCompletionTail.call(this, {
        relaunch,
        newMint,
        alice,
        bob,
        isWsol: true,
      });
    });

    it("misses the threshold and refunds direct- and buy-credited deposits exactly", async function () {
      const { setup, relaunch } =
        await initializeLiveRaydiumRelaunch.call(this);
      await runThresholdMiss.call(this, { setup, relaunch });
    });
  });
}
