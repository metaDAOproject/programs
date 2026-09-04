/**
 * Off-the-top allocation — the one piece of logic unique to credible (everything in
 * ac/ is copied from the accelerated-cranker). Pure and side-effect-free so it
 * can be unit-tested directly (see test/allocation.test.ts).
 *
 * Pre-allocated wallets get a FIXED amount (from the pre-allocation CSV), which
 * must not exceed their commitment. The remaining budget (totalAllocation − Σ
 * pre-allocated) is split among all the regular funders via the accumulator
 * algorithm — identical to the accelerated-cranker.
 */
import type { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import {
  calculateAccumulatorApprovedAmounts,
  type AccumulatorFundingRecord,
  type BoostConfig,
  type FundEvent,
} from "./ac/accumulator";
import type { FundingApproval } from "./ac/fundingApproval";

/** A funder's line in the allocation table. */
export interface AllocationLine {
  funder: PublicKey;
  committedAmount: BN;
  approvedAmount: BN;
  /** "pre" (pre-allocated fixed amount) or "accum" (accumulator-allocated). */
  kind: "pre" | "accum";
  /** Unix timestamp (s) of the funder's last fund() call — the sort key for the display. */
  lastAccumulatorUpdate: BN;
  /**
   * Unix timestamp (s) of the funder's FIRST fund (from fund events). Equals
   * lastAccumulatorUpdate for single-contribution funders; earlier for those who
   * topped up (the display shows first→last only when they differ).
   */
  firstFundTime: BN;
}

/** Result of the off-the-top allocation. */
export interface AllocationResult {
  lines: AllocationLine[];
  approvals: FundingApproval[];
  preAllocatedTotal: BN;
  remaining: BN;
}

/**
 * @param records — every funder's on-chain record (pre-allocated + regular)
 * @param preAllocated — base58 wallet → fixed allocation (atoms). Each wallet must
 *   be a funder, and its amount must not exceed that funder's committed.
 * @param totalAllocation — total to allocate across everyone (atoms)
 * @param launchStartTime / secondsForLaunch / accumulatorActivationDelaySeconds — launch timing
 * @param boost — accumulator boost config
 * @param fundEvents — per-tx fund events for the boost (pre-allocated are filtered out)
 * @returns per-funder lines + approvals, with Σ approved === totalAllocation
 * @throws if a pre-allocated wallet isn't a funder, its amount exceeds committed,
 *   or the pre-allocated total exceeds totalAllocation
 */
export function computeAllocation(
  records: AccumulatorFundingRecord[],
  preAllocated: Map<string, BN>,
  totalAllocation: BN,
  launchStartTime: BN,
  secondsForLaunch: BN,
  accumulatorActivationDelaySeconds: BN,
  boost: BoostConfig,
  fundEvents: FundEvent[],
): AllocationResult {
  const recordByAddr = new Map(records.map((r) => [r.funder.toBase58(), r]));

  // Validate every pre-allocated wallet against chain: it must be a funder, and its
  // fixed amount must not exceed its commitment (can't approve more than committed).
  for (const [addr, amount] of preAllocated) {
    const rec = recordByAddr.get(addr);
    if (!rec)
      throw new Error(
        `Pre-allocated wallet ${addr} has no funding record on this launch`,
      );
    if (amount.gt(rec.committedAmount)) {
      throw new Error(
        `Pre-allocated amount for ${addr} (${amount.toString()}) exceeds its committed (${rec.committedAmount.toString()})`,
      );
    }
  }

  const preAllocatedRecords = records.filter((r) =>
    preAllocated.has(r.funder.toBase58()),
  );
  const regularRecords = records.filter(
    (r) => !preAllocated.has(r.funder.toBase58()),
  );

  // Earliest fund time per funder, for the display. The on-chain record stores
  // only the LAST fund; the first comes from fund events. Falls back to the
  // record's time for single-contribution funders (first == last, no arrow shown).
  const eventCountByFunder = new Map<string, number>();
  const firstFundByFunder = new Map<string, BN>();
  for (const e of fundEvents) {
    eventCountByFunder.set(
      e.funderAddr,
      (eventCountByFunder.get(e.funderAddr) ?? 0) + 1,
    );
    const cur = firstFundByFunder.get(e.funderAddr);
    if (!cur || e.timestamp.lt(cur))
      firstFundByFunder.set(e.funderAddr, e.timestamp);
  }
  const firstFundOf = (funder: string, lastFund: BN): BN =>
    (eventCountByFunder.get(funder) ?? 0) > 1
      ? firstFundByFunder.get(funder)!
      : lastFund;

  // Step A: pre-allocated wallets get their fixed amount.
  const preAllocatedLines: AllocationLine[] = preAllocatedRecords.map((r) => ({
    funder: r.funder,
    committedAmount: r.committedAmount,
    approvedAmount: preAllocated.get(r.funder.toBase58())!,
    kind: "pre",
    lastAccumulatorUpdate: r.lastAccumulatorUpdate,
    firstFundTime: firstFundOf(r.funder.toBase58(), r.lastAccumulatorUpdate),
  }));
  let preAllocatedTotal = new BN(0);
  for (const l of preAllocatedLines)
    preAllocatedTotal = preAllocatedTotal.add(l.approvedAmount);

  // Step B: the regular funders split the remainder via the accumulator algorithm.
  const remaining = totalAllocation.sub(preAllocatedTotal);
  if (remaining.isNeg()) {
    throw new Error(
      `Pre-allocated total ${preAllocatedTotal.toString()} > totalAllocation ${totalAllocation.toString()} — raise the total or reduce allocations`,
    );
  }
  if (remaining.gt(new BN(0)) && regularRecords.length === 0) {
    throw new Error(
      `Remaining ${remaining.toString()} to allocate but no regular funders exist — nobody can absorb it`,
    );
  }

  // Regular funders split `remaining` via the accumulator (handles remaining === 0
  // by approving all of them zero). Only pass fund events for the regular funders —
  // the pre-allocated wallets are out of the pool.
  const regularFundEvents = fundEvents.filter(
    (e) => !preAllocated.has(e.funderAddr),
  );
  const regularApprovals = calculateAccumulatorApprovedAmounts(
    regularRecords,
    remaining,
    launchStartTime,
    secondsForLaunch,
    accumulatorActivationDelaySeconds,
    boost,
    regularFundEvents,
  );
  const regularLines: AllocationLine[] = regularApprovals.map((a) => {
    const rec = recordByAddr.get(a.funder.toBase58())!;
    return {
      funder: a.funder,
      committedAmount: rec.committedAmount,
      approvedAmount: a.approvedAmount,
      kind: "accum",
      lastAccumulatorUpdate: rec.lastAccumulatorUpdate,
      firstFundTime: firstFundOf(
        a.funder.toBase58(),
        rec.lastAccumulatorUpdate,
      ),
    };
  });

  const lines = [...preAllocatedLines, ...regularLines];
  const approvals: FundingApproval[] = lines.map((l) => ({
    funder: l.funder,
    approvedAmount: l.approvedAmount,
  }));
  return { lines, approvals, preAllocatedTotal, remaining };
}
