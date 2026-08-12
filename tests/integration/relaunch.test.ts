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
import { ensureWhirlpool, WhirlpoolFixture } from "../relaunch/whirlpool.js";

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
// Small enough that the sell proceeds (~5 SOL) swap through the whirlpool
// fixture (1000 SOL / 100k USDC) with well under 1% price impact.
const WSOL_POOL_QUOTE_RESERVE = 5n * 10n ** 9n; // 5 SOL
const USDC_POOL_QUOTE_RESERVE = 100_000n * 10n ** 6n; // 100k USDC

const TOKENS_TO_DEPOSITORS = 10_000_000n * 10n ** 6n;
const TOKENS_TO_FUTARCHY_LIQUIDITY = 2_000_000n * 10n ** 6n;
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

    // Price identity: the TWAP opens at the raise valued over the depositor
    // bucket, and the AMM opens at exactly that ratio — the full 2M
    // liquidity bucket against raise/5.
    const expectedTwap = (usdcRecovered * PRICE_SCALE) / TOKENS_TO_DEPOSITORS;
    assert.equal(
      storedDao.twapInitialObservation.toString(),
      expectedTwap.toString(),
    );
    assert.equal(
      storedDao.twapMaxObservationChangePerUpdate.toString(),
      (expectedTwap / 20n).toString(),
    );

    const usdcToLp = usdcRecovered / 5n;
    const spot = storedDao.amm.state.spot.spot;
    const baseReserves = BigInt(spot.baseReserves.toString());
    const quoteReserves = BigInt(spot.quoteReserves.toString());
    assert.equal(
      baseReserves.toString(),
      TOKENS_TO_FUTARCHY_LIQUIDITY.toString(),
    );
    assert.equal(quoteReserves.toString(), usdcToLp.toString());
    assert.equal(
      ((quoteReserves * PRICE_SCALE) / baseReserves).toString(),
      expectedTwap.toString(),
    );

    // Treasury remainder: whatever the LP seed left goes to the Squads
    // vault, conserving every raw unit of the raise.
    const treasuryBalance = await tokenBalance(
      this.banksClient,
      token.getAssociatedTokenAddressSync(MAINNET_USDC, stored.daoVault, true),
    );
    assert.equal(
      treasuryBalance.toString(),
      (usdcRecovered - usdcToLp).toString(),
    );
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

    // Claims: 10M × 60M/100M, 10M × 39.99M/100M, 10M × 10k/100M — every
    // share divides exactly, so the vault empties with zero dust.
    await client
      .claimIx({ relaunch, newMint, depositor: alice.publicKey })
      .rpc();
    await client.claimIx({ relaunch, newMint, depositor: bob.publicKey }).rpc();
    await client.claimIx({ relaunch, newMint }).rpc();

    const expectedClaims: [PublicKey, bigint][] = [
      [alice.publicKey, 6_000_000n * 10n ** 6n],
      [bob.publicKey, 3_999_000n * 10n ** 6n],
      [this.payer.publicKey, 1_000n * 10n ** 6n],
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

  it("misses the threshold and refunds every deposit exactly", async function () {
    const { setup, relaunch } = await initializeLiveRelaunch.call(this, {
      quoteMint: token.NATIVE_MINT,
      oldTokenProgram: token.TOKEN_PROGRAM_ID,
    });

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
}
