import type { IdlTypes } from "@coral-xyz/anchor";
import BN from "bn.js";

import type {
  Dao,
  FutarchyProgram,
} from "../../../futarchy/v0.6/types/index.js";
import type {
  PerformancePackage,
  WithdrawalLimits,
  WithdrawalPolicy,
  WindowUsage,
} from "../types/index.js";

const PRICE_SCALE = new BN(10).pow(new BN(12));

// Futarchy's spot swap fees, in basis points
const MAX_BPS = new BN(10_000);
const PROTOCOL_TAKER_FEE_BPS = new BN(50);
const LP_TAKER_FEE_BPS = new BN(0);

type SpotPool = IdlTypes<FutarchyProgram>["Pool"];

// Anchor's decoded Dao type drops the pool struct nested in the PoolState enum, so it is retyped here.
function getSpotPool(dao: Dao): SpotPool {
  const state = dao.amm.state as {
    spot?: { spot: SpotPool };
    futarchy?: { spot: SpotPool };
  };
  const pool = state.spot?.spot ?? state.futarchy?.spot;
  if (pool === undefined) {
    throw new Error("the Dao has no spot pool");
  }
  return pool;
}

/** The policy whose limits are still in force at `now`; null when the package has none or they have ended. */
export function getActiveWithdrawalPolicy(
  performancePackage: PerformancePackage,
  now: BN | number,
): WithdrawalPolicy | null {
  const policy = performancePackage.withdrawalPolicy;
  if (policy === null || !new BN(now).lt(policy.limits.endTimestamp)) {
    return null;
  }
  return policy;
}

/** The window `now` falls in: its index and the timestamp at which the next window starts. */
export function getWithdrawalWindow(
  limits: WithdrawalLimits,
  now: BN | number,
): { index: BN; end: BN } {
  const windowSeconds = new BN(limits.windowSeconds);
  const index = new BN(now).sub(limits.startTimestamp).div(windowSeconds);
  const end = limits.startTimestamp.add(index.addn(1).mul(windowSeconds));
  return { index, end };
}

/** The counters the next withdrawal is checked against: the stored usage while it is from the current window, zero once the window has rolled. */
export function getEffectiveWindowUsage(
  policy: WithdrawalPolicy,
  now: BN | number,
): WindowUsage {
  const { index } = getWithdrawalWindow(policy.limits, now);
  if (policy.usage.windowIndex.eq(index)) {
    return policy.usage;
  }
  return { windowIndex: index, tokensUsed: new BN(0), quoteUsed: new BN(0) };
}

/** Everything in the vault that is not still locked. */
export function getWithdrawableBalance(
  performancePackage: PerformancePackage,
  vaultAmount: BN,
): BN {
  const locked = performancePackage.totalTokenAmount.sub(
    performancePackage.alreadyUnlockedAmount,
  );
  return vaultAmount.sub(locked);
}

/** The price the program values token withdrawals at: the higher of the Dao's spot observation and its reserve price. */
export function getValuationPrice(dao: Dao): BN {
  const pool = getSpotPool(dao);

  const observation = pool.oracle.lastObservation;
  if (observation.isZero()) {
    throw new Error("the Dao's spot pool has no price observation");
  }

  const reservePrice = pool.baseReserves.isZero()
    ? new BN(0)
    : pool.quoteReserves.mul(PRICE_SCALE).div(pool.baseReserves);

  return BN.max(observation, reservePrice);
}

/** The largest amount `withdraw_tokens` accepts at `now`; the Dao is only needed while limits are active. */
export function getMaxTokenWithdrawal({
  performancePackage,
  vaultAmount,
  now,
  dao,
}: {
  performancePackage: PerformancePackage;
  vaultAmount: BN;
  now: BN | number;
  dao?: Dao;
}): BN {
  const withdrawable = getWithdrawableBalance(performancePackage, vaultAmount);
  const policy = getActiveWithdrawalPolicy(performancePackage, now);
  if (policy === null) {
    return withdrawable;
  }

  const { withdrawalMode, maxTokensPerWindow, maxQuotePerWindow } =
    policy.limits;
  if (
    withdrawalMode.tokens === undefined &&
    withdrawalMode.both === undefined
  ) {
    return new BN(0);
  }
  if (dao === undefined) {
    throw new Error("a Dao is needed to value withdrawals under active limits");
  }

  const usage = getEffectiveWindowUsage(policy, now);
  const tokensRoom = maxTokensPerWindow.sub(usage.tokensUsed);
  const quoteRoom = maxQuotePerWindow.sub(usage.quoteUsed);
  const tokensForQuoteRoom = quoteRoom
    .mul(PRICE_SCALE)
    .div(getValuationPrice(dao));

  return BN.max(
    new BN(0),
    BN.min(withdrawable, BN.min(tokensRoom, tokensForQuoteRoom)),
  );
}

/** The quote atoms the Dao's spot pool pays for `amount` base atoms at its current reserves: the protocol taker fee comes off the input, then the constant-product swap. Exact while the pool is in its spot state and no other swap lands first. */
export function getSellProceedsEstimate(dao: Dao, amount: BN): BN {
  const pool = getSpotPool(dao);

  const inputAfterProtocolFee = amount
    .mul(MAX_BPS.sub(PROTOCOL_TAKER_FEE_BPS))
    .div(MAX_BPS);
  const inputAfterLpFee = inputAfterProtocolFee.mul(
    MAX_BPS.sub(LP_TAKER_FEE_BPS),
  );

  const numerator = inputAfterLpFee.mul(pool.quoteReserves);
  const denominator = pool.baseReserves.mul(MAX_BPS).add(inputAfterLpFee);

  return numerator.div(denominator);
}
