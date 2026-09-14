import {
  ComputeBudgetProgram,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { assert } from "chai";
import BN from "bn.js";
import { ACCOUNT_SIZE, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { LimitsParams, Tranche } from "@metadaoproject/programs";
import {
  getActiveWithdrawalPolicy,
  getMaxTokenWithdrawal,
} from "@metadaoproject/programs/price_based_performance_package/v0.6/withdrawalLimits";
import { expectError } from "../../utils.js";
import {
  runUnlockCycle,
  setDaoOracle,
  setMockOracle,
  setupPackageOnDao,
} from "../utils.js";

const TRANCHE_AMOUNT = 100 * 10 ** 6;
const TOTAL_AMOUNT = 2 * TRANCHE_AMOUNT;

// Capped setup: 2,580,000 tokens unlocked, at most 645,000 tokens or 100,000 USDC
// per 30-day window, priced at $0.072752391878 per token. The pool's reserve price
// sits just below the observation, so the observation is used.
const CAPPED_TRANCHE_AMOUNT = 2_580_000 * 10 ** 6;
const TOKEN_CAP = 645_000 * 10 ** 6;
const QUOTE_CAP = 100_000 * 10 ** 6;
const OBSERVATION = 72_752_391_878n;
const TOKEN_CAP_QUOTE_VALUE = "46925292762";
const ONE_MILLION_TOKENS = 1_000_000n * 10n ** 6n;
const RESERVES_BELOW_OBSERVATION = {
  base: ONE_MILLION_TOKENS,
  quote: 72_000_000_000n,
};
const ONE_HOUR = 60 * 60;
const THIRTY_DAYS = 30 * 24 * ONE_HOUR;
const ONE_YEAR = 365 * 24 * ONE_HOUR;

export default function () {
  let tokenMint: PublicKey;
  let recipient: Keypair;
  let rentPayer: Keypair;
  let performancePackage: PublicKey;
  let oracle: PublicKey;

  beforeEach(async function () {
    recipient = Keypair.generate();
    rentPayer = Keypair.generate();

    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: rentPayer.publicKey,
        lamports: 1_000_000_000,
      }),
    );
    fundTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    fundTx.sign(this.payer);
    await this.banksClient.processTransaction(fundTx);
  });

  function withdrawTokensIx(
    ctx: Mocha.Context,
    amount: number,
    overrides: { recipient?: PublicKey; payer?: PublicKey } = {},
  ) {
    return ctx.priceBasedPerformancePackage.withdrawTokensIx({
      performancePackage,
      oracleAccount: oracle,
      tokenMint,
      recipient: overrides.recipient ?? recipient.publicKey,
      payer: overrides.payer,
      amount: new BN(amount),
    });
  }

  function storedPackage(ctx: Mocha.Context) {
    return ctx.priceBasedPerformancePackage.getPerformancePackage(
      performancePackage,
    );
  }

  // The SDK's maximum token withdrawal at the current clock. The Dao is only
  // fetched while limits are active, as the program only reads it then.
  async function maxWithdrawal(ctx: Mocha.Context) {
    const stored = await storedPackage(ctx);
    const now = Number((await ctx.banksClient.getClock()).unixTimestamp);
    const vaultAmount = new BN(
      (await ctx.getTokenBalance(tokenMint, performancePackage)).toString(),
    );
    const dao = getActiveWithdrawalPolicy(stored, now)
      ? await ctx.futarchy.getDao(oracle)
      : undefined;

    return getMaxTokenWithdrawal({
      performancePackage: stored,
      vaultAmount,
      now,
      dao,
    }).toString();
  }

  describe("without limits", function () {
    beforeEach(async function () {
      oracle = Keypair.generate().publicKey;
      tokenMint = await this.createMint(this.payer.publicKey, 6);
      await this.mintTo(
        tokenMint,
        this.payer.publicKey,
        this.payer,
        TOTAL_AMOUNT,
      );

      performancePackage = await this.setupBasicPerformancePackage({
        tokenMint,
        oracleAccount: oracle,
        recipient: recipient.publicKey,
      });

      // Move past the one-second cliff
      await this.advanceBySeconds(2);
    });

    // Unlocks the first tranche, leaving TRANCHE_AMOUNT withdrawable.
    async function unlockFirstTranche(ctx: Mocha.Context) {
      await runUnlockCycle(ctx, {
        performancePackage,
        oracleAccount: oracle,
        recipient,
        twapPrice: BigInt(1e12),
      });
    }

    it("delivers the whole withdrawable balance and creates the recipient's ATA at the payer's expense", async function () {
      await unlockFirstTranche(this);

      const recipientTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        recipient.publicKey,
      );
      assert.isNull(await this.banksClient.getAccount(recipientTokenAccount));

      const seqNumBefore = (await storedPackage(this)).seqNum.toNumber();
      const rentPayerBefore = await this.banksClient.getBalance(
        rentPayer.publicKey,
      );

      await withdrawTokensIx(this, TRANCHE_AMOUNT, {
        payer: rentPayer.publicKey,
      })
        .signers([recipient, rentPayer])
        .rpc();

      assert.equal(
        await this.getTokenBalance(tokenMint, recipient.publicKey),
        BigInt(TRANCHE_AMOUNT),
      );
      assert.equal(
        await this.getTokenBalance(tokenMint, performancePackage),
        BigInt(TRANCHE_AMOUNT),
      );

      const stored = await storedPackage(this);
      assert.equal(stored.seqNum.toNumber(), seqNumBefore + 1);
      assert.equal(
        stored.alreadyUnlockedAmount.toString(),
        TRANCHE_AMOUNT.toString(),
      );

      const rent = await this.banksClient.getRent();
      assert.equal(
        rentPayerBefore -
          (await this.banksClient.getBalance(rentPayer.publicKey)),
        rent.minimumBalance(BigInt(ACCOUNT_SIZE)),
      );
    });

    it("delivers part of the balance and then the rest", async function () {
      await unlockFirstTranche(this);
      assert.equal(await maxWithdrawal(this), TRANCHE_AMOUNT.toString());

      await withdrawTokensIx(this, 40 * 10 ** 6)
        .signers([recipient])
        .rpc();
      assert.equal(
        await this.getTokenBalance(tokenMint, recipient.publicKey),
        BigInt(40 * 10 ** 6),
      );
      assert.equal(await maxWithdrawal(this), (60 * 10 ** 6).toString());

      await withdrawTokensIx(this, 60 * 10 ** 6)
        .signers([recipient])
        .rpc();
      assert.equal(
        await this.getTokenBalance(tokenMint, recipient.publicKey),
        BigInt(TRANCHE_AMOUNT),
      );
      assert.equal(
        await this.getTokenBalance(tokenMint, performancePackage),
        BigInt(TOTAL_AMOUNT - TRANCHE_AMOUNT),
      );
      assert.equal(await maxWithdrawal(this), "0");
    });

    it("rejects one atom more than the withdrawable balance", async function () {
      await unlockFirstTranche(this);

      const callbacks = expectError(
        "InsufficientWithdrawableBalance",
        "withdrew more than the unlocked amount",
      );

      await withdrawTokensIx(this, TRANCHE_AMOUNT + 1)
        .signers([recipient])
        .rpc()
        .then(callbacks[0], callbacks[1]);

      assert.equal(
        await this.getTokenBalance(tokenMint, performancePackage),
        BigInt(TOTAL_AMOUNT),
      );
    });

    it("rejects any amount while nothing is unlocked", async function () {
      const callbacks = expectError(
        "InsufficientWithdrawableBalance",
        "withdrew from a package with nothing unlocked",
      );

      await withdrawTokensIx(this, 1)
        .signers([recipient])
        .rpc()
        .then(callbacks[0], callbacks[1]);
    });

    it("rejects a zero amount", async function () {
      await unlockFirstTranche(this);

      const callbacks = expectError(
        "RequireGtViolated",
        "withdrew zero tokens",
      );

      await withdrawTokensIx(this, 0)
        .signers([recipient])
        .rpc()
        .then(callbacks[0], callbacks[1]);
    });

    it("rejects a signer other than the recipient", async function () {
      await unlockFirstTranche(this);
      const other = Keypair.generate();

      const callbacks = expectError(
        "ConstraintHasOne",
        "a non-recipient withdrew tokens",
      );

      await withdrawTokensIx(this, TRANCHE_AMOUNT, {
        recipient: other.publicKey,
      })
        .signers([other])
        .rpc()
        .then(callbacks[0], callbacks[1]);
    });

    it("is allowed while the package is unlocking", async function () {
      await unlockFirstTranche(this);

      await setMockOracle(this, oracle, { aggregator: BigInt(1e12) });
      await this.priceBasedPerformancePackage
        .startUnlockIx({
          performancePackage,
          oracleAccount: oracle,
          recipient: recipient.publicKey,
        })
        .signers([recipient])
        .rpc();

      await withdrawTokensIx(this, TRANCHE_AMOUNT).signers([recipient]).rpc();

      const stored = await storedPackage(this);
      assert.isDefined(stored.state.unlocking);
      assert.equal(
        await this.getTokenBalance(tokenMint, recipient.publicKey),
        BigInt(TRANCHE_AMOUNT),
      );
    });
  });

  describe("under a withdrawal policy", function () {
    let startTimestamp: number;
    let withdrawalCount = 0;

    // Creates a package with the limits above on a fresh mint, with a
    // Dao as its oracle, unlocks the first tranche and patches the Dao's spot
    // pool to `observation` and `reserves`.
    async function setupCappedPackage(
      ctx: Mocha.Context,
      {
        limits = {},
        tranches = [
          {
            priceThreshold: new BN(1e12),
            tokenAmount: new BN(CAPPED_TRANCHE_AMOUNT),
          },
          {
            priceThreshold: new BN(2e12),
            tokenAmount: new BN(CAPPED_TRANCHE_AMOUNT),
          },
        ],
        observation = OBSERVATION,
        reserves = RESERVES_BELOW_OBSERVATION,
      }: {
        limits?: Partial<LimitsParams>;
        tranches?: Tranche[];
        observation?: bigint;
        reserves?: { base: bigint; quote: bigint };
      } = {},
    ) {
      tokenMint = await ctx.createMint(ctx.payer.publicKey, 6);
      const quoteMint = await ctx.createMint(ctx.payer.publicKey, 6);
      await ctx.mintTo(
        tokenMint,
        ctx.payer.publicKey,
        ctx.payer,
        tranches.reduce(
          (sum, tranche) => sum + tranche.tokenAmount.toNumber(),
          0,
        ),
      );

      const now = Number((await ctx.banksClient.getClock()).unixTimestamp);
      ({ dao: oracle, performancePackage } = await setupPackageOnDao(ctx, {
        tokenMint,
        quoteMint,
        recipient: recipient.publicKey,
        tranches,
        limits: {
          endTimestamp: new BN(now + ONE_YEAR),
          windowSeconds: THIRTY_DAYS,
          maxTokensPerWindow: new BN(TOKEN_CAP),
          maxQuotePerWindow: new BN(QUOTE_CAP),
          withdrawalMode: { both: {} },
          ...limits,
        },
      }));
      startTimestamp = (
        await storedPackage(ctx)
      ).withdrawalPolicy.limits.startTimestamp.toNumber();

      // Move past the one-second cliff
      await ctx.advanceBySeconds(2);
      await runUnlockCycle(ctx, {
        performancePackage,
        oracleAccount: oracle,
        recipient,
        twapPrice: BigInt(1e12),
        writeOracle: (values) => setDaoOracle(ctx, oracle, values),
      });
      await setDaoOracle(ctx, oracle, {
        lastObservation: observation,
        reserves,
      });
    }

    // A distinct compute-unit price on every call gives repeated identical
    // withdrawals different transaction hashes, so none is rejected as a duplicate.
    function withdraw(ctx: Mocha.Context, amount: number) {
      withdrawalCount += 1;
      return withdrawTokensIx(ctx, amount)
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: withdrawalCount,
          }),
        ])
        .signers([recipient])
        .rpc();
    }

    async function expectWithdrawError(
      ctx: Mocha.Context,
      amount: number,
      error: string,
      message: string,
    ) {
      const callbacks = expectError(error, message);
      await withdraw(ctx, amount).then(callbacks[0], callbacks[1]);
    }

    async function usage(ctx: Mocha.Context) {
      const { usage } = (await storedPackage(ctx)).withdrawalPolicy;
      return {
        windowIndex: usage.windowIndex.toString(),
        tokensUsed: usage.tokensUsed.toString(),
        quoteUsed: usage.quoteUsed.toString(),
      };
    }

    async function advanceTo(ctx: Mocha.Context, timestamp: number) {
      const now = Number((await ctx.banksClient.getClock()).unixTimestamp);
      await ctx.advanceBySeconds(timestamp - now);
    }

    it("ignores an expired policy, its mode included, and does not read the oracle", async function () {
      const now = Number((await this.banksClient.getClock()).unixTimestamp);
      await setupCappedPackage(this, {
        limits: {
          endTimestamp: new BN(now + 1),
          withdrawalMode: { sell: {} },
        },
      });
      await setMockOracle(this, oracle, { aggregator: 0n });
      assert.equal(await maxWithdrawal(this), CAPPED_TRANCHE_AMOUNT.toString());

      await withdraw(this, CAPPED_TRANCHE_AMOUNT);

      assert.equal(
        await this.getTokenBalance(tokenMint, recipient.publicKey),
        BigInt(CAPPED_TRANCHE_AMOUNT),
      );
      assert.deepEqual(await usage(this), {
        windowIndex: "0",
        tokensUsed: "0",
        quoteUsed: "0",
      });
    });

    it("delivers 645,000 tokens valued at the observation", async function () {
      await setupCappedPackage(this);
      const seqNumBefore = (await storedPackage(this)).seqNum.toNumber();
      assert.equal(await maxWithdrawal(this), TOKEN_CAP.toString());

      await withdraw(this, TOKEN_CAP);

      assert.equal(
        await this.getTokenBalance(tokenMint, recipient.publicKey),
        BigInt(TOKEN_CAP),
      );
      assert.equal(
        await this.getTokenBalance(tokenMint, performancePackage),
        BigInt(2 * CAPPED_TRANCHE_AMOUNT - TOKEN_CAP),
      );
      assert.deepEqual(await usage(this), {
        windowIndex: "0",
        tokensUsed: TOKEN_CAP.toString(),
        quoteUsed: TOKEN_CAP_QUOTE_VALUE,
      });
      assert.equal(
        (await storedPackage(this)).seqNum.toNumber(),
        seqNumBefore + 1,
      );
      assert.equal(await maxWithdrawal(this), "0");
    });

    it("rejects one atom over the token cap in the same window", async function () {
      await setupCappedPackage(this);
      await withdraw(this, TOKEN_CAP);
      assert.equal(await maxWithdrawal(this), "0");

      await expectWithdrawError(
        this,
        1,
        "TokenWindowLimitExceeded",
        "withdrew past the window's token cap",
      );

      assert.deepEqual(await usage(this), {
        windowIndex: "0",
        tokensUsed: TOKEN_CAP.toString(),
        quoteUsed: TOKEN_CAP_QUOTE_VALUE,
      });
    });

    it("frees the cap and resets usage in the next window", async function () {
      await setupCappedPackage(this);
      await withdraw(this, TOKEN_CAP);

      await this.advanceBySeconds(THIRTY_DAYS);
      assert.equal(await maxWithdrawal(this), TOKEN_CAP.toString());
      await withdraw(this, TOKEN_CAP);

      assert.equal(
        await this.getTokenBalance(tokenMint, recipient.publicKey),
        BigInt(2 * TOKEN_CAP),
      );
      assert.deepEqual(await usage(this), {
        windowIndex: "1",
        tokensUsed: TOKEN_CAP.toString(),
        quoteUsed: TOKEN_CAP_QUOTE_VALUE,
      });
    });

    it("binds on the quote cap when the reserve price is above the observation", async function () {
      await setupCappedPackage(this, {
        reserves: { base: ONE_MILLION_TOKENS, quote: 465_000_000_000n },
      });
      assert.equal(await maxWithdrawal(this), "215053763440");

      await withdraw(this, 215_053_763_440);
      assert.deepEqual(await usage(this), {
        windowIndex: "0",
        tokensUsed: "215053763440",
        quoteUsed: QUOTE_CAP.toString(),
      });
      assert.equal(await maxWithdrawal(this), "0");

      await expectWithdrawError(
        this,
        1,
        "QuoteWindowLimitExceeded",
        "withdrew past the window's quote cap",
      );
    });

    it("values at the observation when the reserve price has been dumped below it", async function () {
      await setupCappedPackage(this, {
        reserves: { base: ONE_MILLION_TOKENS, quote: 1_000_000_000n },
      });

      await withdraw(this, TOKEN_CAP);

      assert.equal((await usage(this)).quoteUsed, TOKEN_CAP_QUOTE_VALUE);
    });

    it("values at the observation when the pool has no base reserves", async function () {
      await setupCappedPackage(this, {
        reserves: { base: 0n, quote: 1_000_000n },
      });
      assert.equal(await maxWithdrawal(this), TOKEN_CAP.toString());

      await withdraw(this, TOKEN_CAP);

      assert.equal((await usage(this)).quoteUsed, TOKEN_CAP_QUOTE_VALUE);
    });

    it("shares the window's counters across withdrawals", async function () {
      await setupCappedPackage(this);

      assert.equal(await maxWithdrawal(this), TOKEN_CAP.toString());
      await withdraw(this, 200_000 * 10 ** 6);
      assert.equal(await maxWithdrawal(this), (445_000 * 10 ** 6).toString());
      await withdraw(this, 200_000 * 10 ** 6);
      assert.equal(await maxWithdrawal(this), (245_000 * 10 ** 6).toString());
      await withdraw(this, 245_000 * 10 ** 6);
      assert.equal(await maxWithdrawal(this), "0");

      // Each withdrawal's value is rounded up on its own
      assert.deepEqual(await usage(this), {
        windowIndex: "0",
        tokensUsed: TOKEN_CAP.toString(),
        quoteUsed: "46925292763",
      });

      await expectWithdrawError(
        this,
        1,
        "TokenWindowLimitExceeded",
        "withdrew past the token cap shared by earlier withdrawals",
      );
    });

    it("allows a full cap on each side of a window boundary", async function () {
      await setupCappedPackage(this);

      await advanceTo(this, startTimestamp + THIRTY_DAYS - 1);
      assert.equal(await maxWithdrawal(this), TOKEN_CAP.toString());
      await withdraw(this, TOKEN_CAP);
      assert.equal((await usage(this)).windowIndex, "0");
      assert.equal(await maxWithdrawal(this), "0");

      await this.advanceBySeconds(2);
      assert.equal(await maxWithdrawal(this), TOKEN_CAP.toString());
      await withdraw(this, TOKEN_CAP);

      assert.equal(
        await this.getTokenBalance(tokenMint, recipient.publicKey),
        BigInt(2 * TOKEN_CAP),
      );
      assert.deepEqual(await usage(this), {
        windowIndex: "1",
        tokensUsed: TOKEN_CAP.toString(),
        quoteUsed: TOKEN_CAP_QUOTE_VALUE,
      });
    });

    it("rounds the quote value up", async function () {
      await setupCappedPackage(this);

      // One token is worth 72,752.391878 quote atoms at the observation
      await withdraw(this, 1 * 10 ** 6);

      assert.equal((await usage(this)).quoteUsed, "72753");
    });

    it("rejects the token route under mode Sell", async function () {
      await setupCappedPackage(this, {
        limits: { withdrawalMode: { sell: {} } },
      });
      assert.equal(await maxWithdrawal(this), "0");

      await expectWithdrawError(
        this,
        1,
        "WithdrawTokensDisabled",
        "withdrew tokens under mode Sell",
      );
    });

    it("allows the token route under modes Tokens and Both", async function () {
      const modes: LimitsParams["withdrawalMode"][] = [
        { tokens: {} },
        { both: {} },
      ];

      for (const withdrawalMode of modes) {
        await setupCappedPackage(this, { limits: { withdrawalMode } });
        assert.equal(await maxWithdrawal(this), TOKEN_CAP.toString());

        await withdraw(this, TOKEN_CAP);

        assert.equal((await usage(this)).tokensUsed, TOKEN_CAP.toString());
      }
    });

    it("rejects a zero observation even with a reserve price", async function () {
      await setupCappedPackage(this, { observation: 0n });
      await maxWithdrawal(this).then(
        () =>
          assert.fail(
            "computed a maximum withdrawal against a zero observation",
          ),
        (error: Error) => assert.include(error.message, "no price observation"),
      );

      await expectWithdrawError(
        this,
        1,
        "InvalidPriceObservation",
        "withdrew against a zero observation",
      );
    });

    it("rejects an oracle account that is not a Dao", async function () {
      await setupCappedPackage(this);
      await setMockOracle(this, oracle, { aggregator: 0n });

      await expectWithdrawError(
        this,
        1,
        "AccountOwnedByWrongProgram",
        "withdrew against a mock oracle",
      );
    });

    it("rolls a one-hour window every hour", async function () {
      await setupCappedPackage(this, { limits: { windowSeconds: ONE_HOUR } });
      const now = Number((await this.banksClient.getClock()).unixTimestamp);
      const windowIndex = Math.floor((now - startTimestamp) / ONE_HOUR);
      assert.equal(await maxWithdrawal(this), TOKEN_CAP.toString());

      await withdraw(this, TOKEN_CAP);
      assert.deepEqual(await usage(this), {
        windowIndex: windowIndex.toString(),
        tokensUsed: TOKEN_CAP.toString(),
        quoteUsed: TOKEN_CAP_QUOTE_VALUE,
      });
      assert.equal(await maxWithdrawal(this), "0");
      await expectWithdrawError(
        this,
        1,
        "TokenWindowLimitExceeded",
        "withdrew past the hourly token cap",
      );

      await this.advanceBySeconds(ONE_HOUR);
      assert.equal(await maxWithdrawal(this), TOKEN_CAP.toString());
      await withdraw(this, TOKEN_CAP);
      assert.deepEqual(await usage(this), {
        windowIndex: (windowIndex + 1).toString(),
        tokensUsed: TOKEN_CAP.toString(),
        quoteUsed: TOKEN_CAP_QUOTE_VALUE,
      });
    });

    it("rejects a quote value that does not fit in a u64", async function () {
      await setupCappedPackage(this, { observation: 10n ** 26n });
      assert.equal(await maxWithdrawal(this), "0");

      await expectWithdrawError(
        this,
        TOKEN_CAP,
        "QuoteWindowLimitExceeded",
        "withdrew at an observation whose value overflows",
      );
    });

    it("is bound by a withdrawable balance below both caps", async function () {
      const trancheAmount = 100_000 * 10 ** 6;
      await setupCappedPackage(this, {
        tranches: [
          { priceThreshold: new BN(1e12), tokenAmount: new BN(trancheAmount) },
          { priceThreshold: new BN(2e12), tokenAmount: new BN(trancheAmount) },
        ],
      });
      assert.equal(await maxWithdrawal(this), trancheAmount.toString());

      await expectWithdrawError(
        this,
        trancheAmount + 1,
        "InsufficientWithdrawableBalance",
        "withdrew more than the unlocked tranche",
      );

      await withdraw(this, trancheAmount);
      assert.deepEqual(await usage(this), {
        windowIndex: "0",
        tokensUsed: trancheAmount.toString(),
        quoteUsed: "7275239188",
      });
      assert.equal(await maxWithdrawal(this), "0");
    });
  });
}
