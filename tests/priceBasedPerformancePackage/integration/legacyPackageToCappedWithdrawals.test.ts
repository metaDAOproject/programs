import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import BN from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getChangeRequestAddr, LimitsParams } from "@metadaoproject/programs";
import {
  getMaxTokenWithdrawal,
  getSellProceedsEstimate,
} from "@metadaoproject/programs/price_based_performance_package/v0.6/withdrawalLimits";
import { expectError } from "../../utils.js";
import { setupPackageOnDao, stampDaoOracle, uniqueTxIx } from "../utils.js";

// Five tranches of 2,000,000 tokens. The first threshold sits below the pool
// price and unlocks against the Dao's TWAP; the others stay locked above it.
const TRANCHE_AMOUNT = 2_000_000 * 10 ** 6;
const TOTAL_AMOUNT = 5 * TRANCHE_AMOUNT;
const TRANCHE_THRESHOLDS = [5e10, 2e12, 3e12, 4e12, 5e12];
// The Dao's pool opens at $0.0728 per token
const POOL_BASE = 10_000_000 * 10 ** 6;
const POOL_QUOTE = 728_000 * 10 ** 6;
// Kept by the payer for oracle-stamping buys
const PAYER_RESERVE = 1_000 * 10 ** 6;
// At most 645,000 tokens per 30-day window; the quote cap is generous so the token cap binds
const TOKEN_CAP = 645_000 * 10 ** 6;
const QUOTE_CAP = 10_000_000 * 10 ** 6;
const ONE_HOUR = 60 * 60;
const ONE_DAY = 24 * ONE_HOUR;
const THIRTY_DAYS = 30 * ONE_DAY;
const ONE_YEAR = 365 * ONE_DAY;

export default function suite() {
  let tokenMint: PublicKey;
  let quoteMint: PublicKey;
  let dao: PublicKey;
  let performancePackage: PublicKey;
  let recipient: Keypair;

  async function clock(ctx: Mocha.Context): Promise<number> {
    return Number((await ctx.banksClient.getClock()).unixTimestamp);
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

  // Plain JSON, so BNs and keys compare by value.
  function asJson(value: unknown) {
    return JSON.parse(JSON.stringify(value));
  }

  function vaultBalance(ctx: Mocha.Context) {
    return ctx.getTokenBalance(tokenMint, performancePackage);
  }

  function startUnlock(ctx: Mocha.Context) {
    return ctx.priceBasedPerformancePackage
      .startUnlockIx({
        performancePackage,
        oracleAccount: dao,
        recipient: recipient.publicKey,
      })
      .preInstructions([uniqueTxIx()])
      .signers([recipient])
      .rpc();
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

  // The SDK's maximum token withdrawal at the current clock.
  async function maxWithdrawal(ctx: Mocha.Context): Promise<string> {
    return getMaxTokenWithdrawal({
      performancePackage: await storedPackage(ctx),
      vaultAmount: new BN((await vaultBalance(ctx)).toString()),
      now: await clock(ctx),
      dao: await ctx.futarchy.getDao(dao),
    }).toString();
  }

  it("a legacy package becomes capped and cliff-free", async function () {
    recipient = Keypair.generate();
    tokenMint = await this.createMint(this.payer.publicKey, 6);
    quoteMint = await this.createMint(this.payer.publicKey, 6);
    await this.mintTo(
      tokenMint,
      this.payer.publicKey,
      this.payer,
      POOL_BASE + TOTAL_AMOUNT + PAYER_RESERVE,
    );
    await this.mintTo(
      quoteMint,
      this.payer.publicKey,
      this.payer,
      POOL_QUOTE + PAYER_RESERVE,
    );

    // Created without limits, with a cliff 30 days ahead
    const cliff = (await clock(this)) + THIRTY_DAYS;
    ({ dao, performancePackage } = await setupPackageOnDao(this, {
      tokenMint,
      quoteMint,
      recipient: recipient.publicKey,
      tranches: TRANCHE_THRESHOLDS.map((threshold) => ({
        priceThreshold: new BN(threshold),
        tokenAmount: new BN(TRANCHE_AMOUNT),
      })),
      minUnlockTimestamp: new BN(cliff),
    }));
    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: tokenMint,
        quoteMint,
        quoteAmount: new BN(POOL_QUOTE),
        maxBaseAmount: new BN(POOL_BASE),
      })
      .rpc();

    let stored = await storedPackage(this);
    assert.isNull(stored.withdrawalPolicy);
    assert.equal(stored.minUnlockTimestamp.toString(), cliff.toString());
    assert.equal(await vaultBalance(this), BigInt(TOTAL_AMOUNT));

    // Nothing is unlocked and the cliff has not passed
    const earlyWithdraw = expectError(
      "InsufficientWithdrawableBalance",
      "withdrew before anything unlocked",
    );
    await withdrawTokens(this, 1).then(earlyWithdraw[0], earlyWithdraw[1]);
    const earlyUnlock = expectError(
      "UnlockTimestampNotReached",
      "started an unlock before the cliff",
    );
    await startUnlock(this).then(earlyUnlock[0], earlyUnlock[1]);
    assert.equal(await vaultBalance(this), BigInt(TOTAL_AMOUNT));

    // The Dao's TWAP only starts recording after its one-day start delay
    await this.advanceBySeconds(ONE_DAY + 1);

    // The authority proposes new unlock terms: the cliff is lifted to now and
    // withdrawals become capped. The recipient executes an hour later.
    const proposedAt = await clock(this);
    const limits: LimitsParams = {
      endTimestamp: new BN(proposedAt + ONE_YEAR),
      windowSeconds: THIRTY_DAYS,
      maxTokensPerWindow: new BN(TOKEN_CAP),
      maxQuotePerWindow: new BN(QUOTE_CAP),
      withdrawalMode: { both: {} },
    };
    const pdaNonce = Math.floor(Math.random() * 1_000_000);
    await this.priceBasedPerformancePackage
      .proposeChangeIx({
        params: {
          changeType: {
            unlockTerms: { minUnlockTimestamp: new BN(proposedAt), limits },
          },
          pdaNonce,
        },
        performancePackage,
        proposer: this.payer.publicKey,
      })
      .rpc();
    const [changeRequest] = getChangeRequestAddr({
      performancePackage,
      proposer: this.payer.publicKey,
      pdaNonce,
    });

    await this.advanceBySeconds(ONE_HOUR);
    const executedAt = await clock(this);
    await this.priceBasedPerformancePackage
      .executeChangeIx({
        performancePackage,
        changeRequest,
        executor: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    stored = await storedPackage(this);
    assert.equal(stored.minUnlockTimestamp.toString(), proposedAt.toString());
    assert.deepEqual(
      asJson(stored.withdrawalPolicy.limits),
      asJson({ startTimestamp: new BN(executedAt), ...limits }),
    );
    assert.deepEqual(await usage(this), {
      windowIndex: "0",
      tokensUsed: "0",
      quoteUsed: "0",
    });

    // The first tranche unlocks off the Dao's TWAP; the tokens stay in the vault
    await stampDaoOracle(this, { dao, tokenMint, quoteMint });
    await startUnlock(this);
    assert.isDefined((await storedPackage(this)).state.unlocking);

    await this.advanceBySeconds(stored.twapLengthSeconds);
    await stampDaoOracle(this, { dao, tokenMint, quoteMint });
    await this.priceBasedPerformancePackage
      .completeUnlockIx({ performancePackage, oracleAccount: dao })
      .preInstructions([uniqueTxIx()])
      .rpc();

    stored = await storedPackage(this);
    assert.isDefined(stored.state.locked);
    assert.isTrue(stored.tranches[0].isUnlocked);
    assert.isFalse(stored.tranches[1].isUnlocked);
    assert.equal(
      stored.alreadyUnlockedAmount.toString(),
      TRANCHE_AMOUNT.toString(),
    );
    assert.equal(await vaultBalance(this), BigInt(TOTAL_AMOUNT));
    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      0n,
    );

    // The token cap is the most that can leave in this window
    assert.equal(await maxWithdrawal(this), TOKEN_CAP.toString());
    await withdrawTokens(this, TOKEN_CAP);

    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(TOKEN_CAP),
    );
    assert.equal(await vaultBalance(this), BigInt(TOTAL_AMOUNT - TOKEN_CAP));
    const overCap = expectError(
      "TokenWindowLimitExceeded",
      "withdrew past the window's token cap",
    );
    await withdrawTokens(this, 1).then(overCap[0], overCap[1]);
    assert.equal(await maxWithdrawal(this), "0");
    assert.equal((await usage(this)).tokensUsed, TOKEN_CAP.toString());

    // In the next window half the cap is sold into the pool and the other
    // half withdrawn as tokens; both routes count against the same window
    await this.advanceBySeconds(THIRTY_DAYS);
    const halfCap = TOKEN_CAP / 2;
    const poolBaseBefore = await this.getTokenBalance(tokenMint, dao);
    const estimate = getSellProceedsEstimate(
      await this.futarchy.getDao(dao),
      new BN(halfCap),
    );

    await this.priceBasedPerformancePackage
      .withdrawViaSellIx({
        performancePackage,
        dao,
        tokenMint,
        quoteMint,
        recipient: recipient.publicKey,
        amount: new BN(halfCap),
        minQuoteOut: new BN(0),
      })
      .preInstructions([uniqueTxIx()])
      .signers([recipient])
      .rpc();

    assert.equal(
      await this.getTokenBalance(tokenMint, dao),
      poolBaseBefore + BigInt(halfCap),
    );
    assert.equal(
      await vaultBalance(this),
      BigInt(TOTAL_AMOUNT - TOKEN_CAP - halfCap),
    );
    assert.equal(
      (await this.getTokenBalance(quoteMint, recipient.publicKey)).toString(),
      estimate.toString(),
    );
    assert.deepEqual(await usage(this), {
      windowIndex: "1",
      tokensUsed: halfCap.toString(),
      quoteUsed: estimate.toString(),
    });
    const packageQuoteAccount = getAssociatedTokenAddressSync(
      quoteMint,
      performancePackage,
      true,
    );
    assert.isNotNull(await this.banksClient.getAccount(packageQuoteAccount));
    assert.equal(await this.getTokenBalance(quoteMint, performancePackage), 0n);

    await withdrawTokens(this, halfCap);

    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(TOKEN_CAP + halfCap),
    );
    assert.equal(
      await vaultBalance(this),
      BigInt(TOTAL_AMOUNT - 2 * TOKEN_CAP),
    );
    assert.equal((await usage(this)).tokensUsed, TOKEN_CAP.toString());
    assert.equal(await maxWithdrawal(this), "0");
  });
}
