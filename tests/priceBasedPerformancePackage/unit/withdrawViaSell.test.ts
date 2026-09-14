import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import BN from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { LimitsParams } from "@metadaoproject/programs";
import { getSellProceedsEstimate } from "@metadaoproject/programs/price_based_performance_package/v0.6/withdrawalLimits";
import { expectError } from "../../utils.js";
import {
  setMockOracle,
  setupPackageOnDao,
  writeOldLayoutPackage,
} from "../utils.js";

// Two tranches of 2,580,000 tokens; the first unlocks against the Dao's TWAP,
// the second stays locked.
const TRANCHE_AMOUNT = 2_580_000 * 10 ** 6;
const FIRST_THRESHOLD = new BN(5e10);
const LOCKED_THRESHOLD = new BN(2e12);
// At most 645,000 tokens or 100,000 USDC per 30-day window
const TOKEN_CAP = 645_000 * 10 ** 6;
const QUOTE_CAP = 100_000 * 10 ** 6;
// The Dao's pool opens at $0.0728 per token
const POOL_BASE = 10_000_000 * 10 ** 6;
const POOL_QUOTE = 728_000 * 10 ** 6;
// Kept by the payer for oracle-stamping buys and proposal liquidity
const PAYER_RESERVE = 1_000 * 10 ** 6;
const ORACLE_STAMP_BUY = 1 * 10 ** 6;
const ONE_DAY = 24 * 60 * 60;
const THIRTY_DAYS = 30 * ONE_DAY;
const ONE_YEAR = 365 * ONE_DAY;
const NO_USAGE = { windowIndex: "0", tokensUsed: "0", quoteUsed: "0" };

export default function () {
  let tokenMint: PublicKey;
  let quoteMint: PublicKey;
  let recipient: Keypair;
  let performancePackage: PublicKey;
  let dao: PublicKey;
  let uniqueTxCount = 0;

  beforeEach(function () {
    recipient = Keypair.generate();
  });

  // A distinct compute-unit price gives otherwise identical transactions
  // different hashes, so a repeat is not rejected as already processed.
  function uniqueTxIx() {
    uniqueTxCount += 1;
    return ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: uniqueTxCount,
    });
  }

  function storedPackage(ctx: Mocha.Context) {
    return ctx.priceBasedPerformancePackage.getPerformancePackage(
      performancePackage,
    );
  }

  async function usage(ctx: Mocha.Context) {
    const { usage } = (await storedPackage(ctx)).withdrawalPolicy;
    return {
      windowIndex: usage.windowIndex.toString(),
      tokensUsed: usage.tokensUsed.toString(),
      quoteUsed: usage.quoteUsed.toString(),
    };
  }

  async function spotPool(ctx: Mocha.Context) {
    const state = (await ctx.futarchy.getDao(dao)).amm.state as any;
    return state.spot?.spot ?? state.futarchy.spot;
  }

  async function reserves(ctx: Mocha.Context) {
    const pool = await spotPool(ctx);
    return {
      base: pool.baseReserves.toString(),
      quote: pool.quoteReserves.toString(),
    };
  }

  async function estimateProceeds(
    ctx: Mocha.Context,
    amount: number,
  ): Promise<bigint> {
    const estimate = getSellProceedsEstimate(
      await ctx.futarchy.getDao(dao),
      new BN(amount),
    );
    return BigInt(estimate.toString());
  }

  type SellOverrides = {
    minQuoteOut?: number;
    signer?: Keypair;
    oracle?: PublicKey;
  };

  function sellIx(
    ctx: Mocha.Context,
    amount: number,
    { minQuoteOut = 0, signer = recipient, oracle = dao }: SellOverrides = {},
  ) {
    return ctx.priceBasedPerformancePackage
      .withdrawViaSellIx({
        performancePackage,
        dao: oracle,
        tokenMint,
        quoteMint,
        recipient: signer.publicKey,
        amount: new BN(amount),
        minQuoteOut: new BN(minQuoteOut),
      })
      .preInstructions([uniqueTxIx()]);
  }

  function sell(
    ctx: Mocha.Context,
    amount: number,
    overrides: SellOverrides = {},
  ) {
    return sellIx(ctx, amount, overrides)
      .signers([overrides.signer ?? recipient])
      .rpc();
  }

  async function expectSellError(
    ctx: Mocha.Context,
    amount: number,
    error: string,
    message: string,
    overrides: SellOverrides = {},
  ) {
    const callbacks = expectError(error, message);
    await sell(ctx, amount, overrides).then(callbacks[0], callbacks[1]);
  }

  function withdrawTokens(ctx: Mocha.Context, amount: number) {
    return ctx.priceBasedPerformancePackage
      .withdrawTokensIx({
        performancePackage,
        oracleAccount: dao,
        tokenMint,
        recipient: recipient.publicKey,
        amount: new BN(amount),
      })
      .preInstructions([uniqueTxIx()])
      .signers([recipient])
      .rpc();
  }

  // A small buy from the payer, which moves the Dao oracle's last updated
  // timestamp to now.
  async function stampOracle(ctx: Mocha.Context) {
    await ctx.futarchy
      .spotSwapIx({
        dao,
        baseMint: tokenMint,
        quoteMint,
        swapType: "buy",
        inputAmount: new BN(ORACLE_STAMP_BUY),
      })
      .preInstructions([uniqueTxIx()])
      .rpc();
  }

  async function startUnlock(ctx: Mocha.Context) {
    await ctx.priceBasedPerformancePackage
      .startUnlockIx({
        performancePackage,
        oracleAccount: dao,
        recipient: recipient.publicKey,
      })
      .preInstructions([uniqueTxIx()])
      .signers([recipient])
      .rpc();
  }

  // Unlocks the first tranche off the Dao's own TWAP: the oracle is stamped
  // right before start_unlock and again one TWAP length later for
  // complete_unlock.
  async function unlockFirstTranche(ctx: Mocha.Context) {
    await stampOracle(ctx);
    await startUnlock(ctx);

    await ctx.advanceBySeconds((await storedPackage(ctx)).twapLengthSeconds);
    await stampOracle(ctx);
    await ctx.priceBasedPerformancePackage
      .completeUnlockIx({ performancePackage, oracleAccount: dao })
      .preInstructions([uniqueTxIx()])
      .rpc();
  }

  // Creates a package with the limits above on a fresh mint, with a Dao as its
  // oracle, seeds the Dao's pool and unlocks the first tranche. `limits: null`
  // creates the package without limits.
  async function setupSellablePackage(
    ctx: Mocha.Context,
    { limits = {} }: { limits?: Partial<LimitsParams> | null } = {},
  ) {
    tokenMint = await ctx.createMint(ctx.payer.publicKey, 6);
    quoteMint = await ctx.createMint(ctx.payer.publicKey, 6);
    await ctx.mintTo(
      tokenMint,
      ctx.payer.publicKey,
      ctx.payer,
      POOL_BASE + 2 * TRANCHE_AMOUNT + PAYER_RESERVE,
    );
    await ctx.mintTo(
      quoteMint,
      ctx.payer.publicKey,
      ctx.payer,
      POOL_QUOTE + PAYER_RESERVE,
    );

    const now = Number((await ctx.banksClient.getClock()).unixTimestamp);
    ({ dao, performancePackage } = await setupPackageOnDao(ctx, {
      tokenMint,
      quoteMint,
      recipient: recipient.publicKey,
      tranches: [
        {
          priceThreshold: FIRST_THRESHOLD,
          tokenAmount: new BN(TRANCHE_AMOUNT),
        },
        {
          priceThreshold: LOCKED_THRESHOLD,
          tokenAmount: new BN(TRANCHE_AMOUNT),
        },
      ],
      limits:
        limits === null
          ? undefined
          : {
              endTimestamp: new BN(now + ONE_YEAR),
              windowSeconds: THIRTY_DAYS,
              maxTokensPerWindow: new BN(TOKEN_CAP),
              maxQuotePerWindow: new BN(QUOTE_CAP),
              withdrawalMode: { both: {} },
              ...limits,
            },
    }));

    await ctx.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: tokenMint,
        quoteMint,
        quoteAmount: new BN(POOL_QUOTE),
        maxBaseAmount: new BN(POOL_BASE),
      })
      .rpc();

    // The Dao's TWAP only starts recording after its one-day start delay
    await ctx.advanceBySeconds(ONE_DAY + 1);
    await unlockFirstTranche(ctx);
  }

  it("sells under mode Both and forwards the proceeds to the recipient", async function () {
    await setupSellablePackage(this);
    const seqNumBefore = (await storedPackage(this)).seqNum.toNumber();
    const poolBaseBefore = await this.getTokenBalance(tokenMint, dao);
    const packageQuoteAccount = getAssociatedTokenAddressSync(
      quoteMint,
      performancePackage,
      true,
    );
    assert.isNull(await this.banksClient.getAccount(packageQuoteAccount));

    // 645,000 tokens into the $0.0728 pool are worth about 43,900 USDC after the 0.5% fee
    const estimate = await estimateProceeds(this, TOKEN_CAP);
    assert.isAbove(Number(estimate), 43_000 * 10 ** 6);
    assert.isBelow(Number(estimate), 44_000 * 10 ** 6);

    await sell(this, TOKEN_CAP);

    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      BigInt(2 * TRANCHE_AMOUNT - TOKEN_CAP),
    );
    assert.equal(
      await this.getTokenBalance(tokenMint, dao),
      poolBaseBefore + BigInt(TOKEN_CAP),
    );
    assert.equal(
      await this.getTokenBalance(quoteMint, recipient.publicKey),
      estimate,
    );
    assert.isNotNull(await this.banksClient.getAccount(packageQuoteAccount));
    assert.equal(await this.getTokenBalance(quoteMint, performancePackage), 0n);

    assert.deepEqual(await usage(this), {
      windowIndex: "0",
      tokensUsed: TOKEN_CAP.toString(),
      quoteUsed: estimate.toString(),
    });
    assert.equal(
      (await storedPackage(this)).seqNum.toNumber(),
      seqNumBefore + 1,
    );
  });

  it("forwards only the pool's proceeds, leaving a donation in the package's quote account", async function () {
    await setupSellablePackage(this);
    const donation = 1 * 10 ** 6;
    await this.mintTo(quoteMint, performancePackage, this.payer, donation);
    const estimate = await estimateProceeds(this, TOKEN_CAP);

    await sell(this, TOKEN_CAP);

    assert.equal(
      await this.getTokenBalance(quoteMint, recipient.publicKey),
      estimate,
    );
    assert.equal(
      await this.getTokenBalance(quoteMint, performancePackage),
      BigInt(donation),
    );
    assert.equal((await usage(this)).quoteUsed, estimate.toString());
  });

  it("rejects proceeds above the quote cap", async function () {
    await setupSellablePackage(this, {
      limits: { maxQuotePerWindow: new BN(10_000 * 10 ** 6) },
    });
    const reservesBefore = await reserves(this);

    await expectSellError(
      this,
      TOKEN_CAP,
      "QuoteWindowLimitExceeded",
      "sold for more than the window's quote cap",
    );

    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      BigInt(2 * TRANCHE_AMOUNT),
    );
    assert.deepEqual(await reserves(this), reservesBefore);
    assert.equal(
      await this.getTokenBalance(quoteMint, recipient.publicKey),
      0n,
    );
    assert.deepEqual(await usage(this), NO_USAGE);
  });

  it("rejects an amount above the token cap", async function () {
    await setupSellablePackage(this);
    const reservesBefore = await reserves(this);

    await expectSellError(
      this,
      TOKEN_CAP + 1,
      "TokenWindowLimitExceeded",
      "sold more than the window's token cap",
    );

    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      BigInt(2 * TRANCHE_AMOUNT),
    );
    assert.deepEqual(await reserves(this), reservesBefore);
    assert.deepEqual(await usage(this), NO_USAGE);
  });

  it("rejects a minimum quote out above the pool's price", async function () {
    await setupSellablePackage(this);
    const reservesBefore = await reserves(this);
    const estimate = await estimateProceeds(this, TOKEN_CAP);

    await expectSellError(
      this,
      TOKEN_CAP,
      "RequireGteViolated",
      "sold for less than the minimum quote out",
      { minQuoteOut: Number(estimate) + 1 },
    );

    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      BigInt(2 * TRANCHE_AMOUNT),
    );
    assert.deepEqual(await reserves(this), reservesBefore);
    assert.deepEqual(await usage(this), NO_USAGE);

    await sell(this, TOKEN_CAP, { minQuoteOut: Number(estimate) });
    assert.equal(
      await this.getTokenBalance(quoteMint, recipient.publicKey),
      estimate,
    );
  });

  it("rejects the sell route under mode Tokens", async function () {
    await setupSellablePackage(this, {
      limits: { withdrawalMode: { tokens: {} } },
    });

    await expectSellError(
      this,
      TOKEN_CAP,
      "WithdrawViaSellDisabled",
      "sold under mode Tokens",
    );
  });

  it("allows only the sell route under mode Sell", async function () {
    await setupSellablePackage(this, {
      limits: { withdrawalMode: { sell: {} } },
    });

    const callbacks = expectError(
      "WithdrawTokensDisabled",
      "withdrew tokens under mode Sell",
    );
    await withdrawTokens(this, TOKEN_CAP).then(callbacks[0], callbacks[1]);

    const estimate = await estimateProceeds(this, TOKEN_CAP);
    await sell(this, TOKEN_CAP);

    assert.equal(
      await this.getTokenBalance(quoteMint, recipient.publicKey),
      estimate,
    );
    assert.equal((await usage(this)).tokensUsed, TOKEN_CAP.toString());
  });

  it("sells uncapped when the package has no limits", async function () {
    await setupSellablePackage(this, { limits: null });
    const estimate = await estimateProceeds(this, TRANCHE_AMOUNT);

    await sell(this, TRANCHE_AMOUNT);

    assert.equal(
      await this.getTokenBalance(quoteMint, recipient.publicKey),
      estimate,
    );
    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      BigInt(TRANCHE_AMOUNT),
    );
    assert.isNull((await storedPackage(this)).withdrawalPolicy);
  });

  it("sells uncapped under an expired policy, its mode included", async function () {
    const now = Number((await this.banksClient.getClock()).unixTimestamp);
    await setupSellablePackage(this, {
      limits: {
        endTimestamp: new BN(now + 1),
        withdrawalMode: { tokens: {} },
      },
    });
    const estimate = await estimateProceeds(this, TRANCHE_AMOUNT);

    await sell(this, TRANCHE_AMOUNT);

    assert.equal(
      await this.getTokenBalance(quoteMint, recipient.publicKey),
      estimate,
    );
    assert.deepEqual(await usage(this), NO_USAGE);
  });

  it("rejects a signer other than the recipient", async function () {
    await setupSellablePackage(this);

    await expectSellError(
      this,
      TOKEN_CAP,
      "ConstraintHasOne",
      "a non-recipient sold tokens",
      { signer: Keypair.generate() },
    );
  });

  it("rejects a Dao other than the package's oracle account", async function () {
    await setupSellablePackage(this);
    const otherDao = await this.setupBasicDao({
      baseMint: tokenMint,
      quoteMint,
    });

    await expectSellError(
      this,
      TOKEN_CAP,
      "ConstraintAddress",
      "sold through a Dao that is not the package's oracle",
      { oracle: otherDao },
    );
  });

  it("rejects an oracle Dao whose base mint is another token", async function () {
    await setupSellablePackage(this);
    const otherMint = await this.createMint(this.payer.publicKey, 6);
    const otherDao = await this.setupBasicDao({
      baseMint: otherMint,
      quoteMint,
    });
    performancePackage = await this.setupBasicPerformancePackage({
      tokenMint,
      oracleAccount: otherDao,
      byteOffset: 9,
      recipient: recipient.publicKey,
    });

    const callbacks = expectError(
      "ConstraintRaw",
      "sold through a Dao on another token",
    );
    await sellIx(this, 1, { oracle: otherDao })
      .accounts({
        ammBaseVault: getAssociatedTokenAddressSync(otherMint, otherDao, true),
      })
      .signers([recipient])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects an oracle account that is not a Dao", async function () {
    await setupSellablePackage(this);
    const mockOracle = Keypair.generate().publicKey;
    await setMockOracle(this, mockOracle, { aggregator: 0n });
    performancePackage = await this.setupBasicPerformancePackage({
      tokenMint,
      oracleAccount: mockOracle,
      recipient: recipient.publicKey,
    });

    await expectSellError(
      this,
      1,
      "AccountOwnedByWrongProgram",
      "sold through a mock oracle",
      { oracle: mockOracle },
    );
  });

  it("sells while the Dao has a live proposal", async function () {
    await setupSellablePackage(this);
    await this.initializeAndLaunchProposal({
      dao,
      instructions: [
        {
          programId: MEMO_PROGRAM_ID,
          keys: [],
          data: Buffer.from("hello, world"),
        },
      ],
    });
    assert.isDefined((await this.futarchy.getDao(dao)).amm.state.futarchy);

    // With a proposal live the pool also pays out the arbitrage profit, so the spot estimate is a floor
    const estimate = await estimateProceeds(this, TOKEN_CAP);
    await sell(this, TOKEN_CAP);

    const received = await this.getTokenBalance(quoteMint, recipient.publicKey);
    assert.isAtLeast(Number(received), Number(estimate));
    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      BigInt(2 * TRANCHE_AMOUNT - TOKEN_CAP),
    );
    assert.equal(await this.getTokenBalance(quoteMint, performancePackage), 0n);
    assert.deepEqual(await usage(this), {
      windowIndex: "0",
      tokensUsed: TOKEN_CAP.toString(),
      quoteUsed: received.toString(),
    });
  });

  it("counts a token withdrawal and a sale against one window", async function () {
    // The token route values at the oracle's observation, still near the $1 it started at
    await setupSellablePackage(this, {
      limits: { maxQuotePerWindow: new BN(1_000_000 * 10 ** 6) },
    });
    const tokenAmount = 300_000 * 10 ** 6;
    const sellAmount = TOKEN_CAP - tokenAmount;

    await withdrawTokens(this, tokenAmount);
    const { quoteUsed: tokenValue } = await usage(this);
    const estimate = await estimateProceeds(this, sellAmount);

    await sell(this, sellAmount);

    assert.deepEqual(await usage(this), {
      windowIndex: "0",
      tokensUsed: TOKEN_CAP.toString(),
      quoteUsed: (BigInt(tokenValue) + estimate).toString(),
    });

    await expectSellError(
      this,
      1,
      "TokenWindowLimitExceeded",
      "sold past the token cap shared with a token withdrawal",
    );
    const callbacks = expectError(
      "TokenWindowLimitExceeded",
      "withdrew past the token cap shared with a sale",
    );
    await withdrawTokens(this, 1).then(callbacks[0], callbacks[1]);
  });

  it("rejects more than the withdrawable balance and a zero amount", async function () {
    await setupSellablePackage(this);

    await expectSellError(
      this,
      TRANCHE_AMOUNT + 1,
      "InsufficientWithdrawableBalance",
      "sold more than the unlocked tranche",
    );
    await expectSellError(this, 0, "RequireGtViolated", "sold zero tokens");
  });

  it("is allowed while the package is unlocking", async function () {
    await setupSellablePackage(this);
    await startUnlock(this);
    assert.isDefined((await storedPackage(this)).state.unlocking);
    const estimate = await estimateProceeds(this, TOKEN_CAP);

    await sell(this, TOKEN_CAP);

    const stored = await storedPackage(this);
    assert.isDefined(stored.state.unlocking);
    assert.equal(
      await this.getTokenBalance(quoteMint, recipient.publicKey),
      estimate,
    );
  });

  it("rejects a package that has not been resized", async function () {
    await setupSellablePackage(this);
    await writeOldLayoutPackage(this, performancePackage);

    await expectSellError(
      this,
      TOKEN_CAP,
      "AccountNotMigrated",
      "sold from a package in the old layout",
    );
  });
}
