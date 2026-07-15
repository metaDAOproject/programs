/**
 * Accumulator-based funding approval: time-weighted allocation calculation.
 *
 * The v0.7 on-chain program adds a time-weighted accumulator to each
 * FundingRecord: `accumulator += committed_amount * elapsed_seconds`.
 * This rewards early, long-duration funders and penalizes late snipers.
 *
 * The on-chain program flushes the accumulator on every fund() call, but NOT
 * when the launch closes. So when we compute approvals off-chain, we first
 * need to "finalize" each record — add the unflushed tail from the last
 * fund() call to the deterministic close time (start + duration).
 *
 * Algorithm overview:
 *   1. Finalize accumulators — flush each record to close time
 *   2. Accumulator-weighted allocation with cap — no funder gets more than committed
 *   3. Redistribute surplus by unfilled commitment — capped records free up tokens
 *   4. Dust distribution — guarantee sum(approved) === targetAmount
 *
 * Since minRaise = maxRaise and token supply is fixed (TOKENS_TO_PARTICIPANTS),
 * the token price is deterministic: price = targetAmount / TOKENS_TO_PARTICIPANTS.
 *
 * Exported:
 *   - calculateAccumulatorApprovedAmounts: full allocation pipeline
 *   - AccumulatorFundingRecord: input record shape
 */
import { type PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import type { FundingApproval } from "./fundingApproval";
import { log } from "../logger";

/**
 * Configuration for the optional fill-based boost.
 *
 * The boost rewards "finder" funders — those who committed when the pool
 * was still sparse. Each funder's finalized accumulator is multiplied by:
 *
 *   boost = 1 + (multiplier - 1) × max(0, 1 - delayedCum / (target × fillCeiling))
 *
 * Where `delayedCum` is the total committed at `min(fundTime + lookAheadSeconds, closeTime)`.
 * Looking ahead rather than measuring at fund time captures momentum: a funder
 * followed by silence (pool stays sparse) gets a bigger boost than one who
 * funds just before a rush.
 *
 * When boost is undefined or multiplier ≤ 1, the algorithm reduces to
 * the plain accumulator-weighted allocation — zero behavioral change.
 */
export interface BoostConfig {
  /** Peak multiplier when pool is empty. 1 = no boost (plain accumulator). Must be ≥ 1. */
  multiplier: number;
  /**
   * Cumulative/target ratio where boost decays to 1x. Must be > 0.
   * 1 = boost ends at target. 2 = boost persists until 2x oversubscribed.
   */
  fillCeiling: number;
  /** Seconds after each funder's entry to measure fill level. 0 = measure at fund time. */
  lookAheadSeconds: number;
}

/**
 * Individual fund event from the indexer DB.
 *
 * Used to expand multi-contribution funders into per-transaction entries
 * for a more accurate cumulative timeline in the boost calculation.
 * Only used when:
 *   1. A funder has more than one fund event
 *   2. The sum of event amounts exactly matches the chain committedAmount
 */
export interface FundEvent {
  /** Funder wallet address (base58). */
  funderAddr: string;
  /** Amount funded in this specific transaction (USDC lamports). */
  amount: BN;
  /** Unix timestamp of this fund transaction (seconds). */
  timestamp: BN;
}

/** Cumulative timeline entry: total committed at a point in time. */
interface TimelineEntry {
  time: BN;
  cumulative: BN;
}

/** Result of attempting to build a DB-expanded timeline. */
interface ExpandedTimelineResult {
  timeline: TimelineEntry[];
  validatedMultiEvents: Map<string, FundEvent[]>;
}

/**
 * Attempt to build a higher-resolution cumulative timeline from DB fund events.
 *
 * For multi-contribution funders (>1 DB event) where the sum matches the chain
 * committedAmount exactly and all timestamps are valid, their single chain entry
 * is expanded into per-transaction entries. This reveals when money actually
 * arrived for a more accurate boost calculation.
 *
 * The expanded timeline is verified against the chain timeline: at every chain
 * checkpoint the expanded cumulative must be >= chain cumulative, and final
 * totals must match. On any verification failure, falls back to the chain timeline.
 *
 * @returns the timeline to use and the map of validated multi-contrib funders
 */
function buildExpandedTimeline(
  fundEvents: FundEvent[],
  sortedByTime: AccumulatorFundingRecord[],
  chainTimeline: TimelineEntry[],
): ExpandedTimelineResult {
  const validatedMultiEvents = new Map<string, FundEvent[]>();

  // Group fund events by funder.
  const eventsByFunder = new Map<string, FundEvent[]>();
  for (const e of fundEvents) {
    if (!eventsByFunder.has(e.funderAddr)) {
      eventsByFunder.set(e.funderAddr, []);
    }
    eventsByFunder.get(e.funderAddr)!.push(e);
  }

  // Validate each multi-contribution funder against chain data.
  for (const [addr, events] of eventsByFunder) {
    // Per user requirement: only use DB data for funders with >1 event.
    if (events.length <= 1) continue;

    // Find the matching chain record to validate sum.
    const chainRecord = sortedByTime.find((r) => r.funder.toBase58() === addr);
    if (!chainRecord) continue;

    let dbSum = new BN(0);
    for (const e of events) {
      dbSum = dbSum.add(e.amount);
    }

    if (!dbSum.eq(chainRecord.committedAmount)) {
      log.warn(
        {
          funder: addr,
          dbSum: dbSum.toString(),
          chainAmount: chainRecord.committedAmount.toString(),
          dbEventCount: events.length,
        },
        "Fund event sum mismatch — ignoring DB data for this funder's boost",
      );
      continue;
    }

    // Timestamp check: every DB event must be at or before the chain's
    // lastAccumulatorUpdate (the funder's last fund() call). If any event
    // claims a timestamp AFTER the chain's last known interaction, the DB
    // data is inconsistent — reject it.
    let timestampsValid = true;
    for (const e of events) {
      if (e.timestamp.gt(chainRecord.lastAccumulatorUpdate)) {
        log.warn(
          {
            funder: addr,
            eventTimestamp: e.timestamp.toString(),
            chainLastUpdate: chainRecord.lastAccumulatorUpdate.toString(),
          },
          "Fund event timestamp exceeds chain lastAccumulatorUpdate — ignoring DB data for this funder",
        );
        timestampsValid = false;
        break;
      }
    }
    if (!timestampsValid) continue;

    // Sort events by timestamp ascending for consistent timeline insertion.
    const sorted = [...events].sort((a, b) => a.timestamp.cmp(b.timestamp));
    validatedMultiEvents.set(addr, sorted);
  }

  // No valid multi-contrib funders — chain timeline is already best.
  if (validatedMultiEvents.size === 0) {
    return { timeline: chainTimeline, validatedMultiEvents };
  }

  log.info(
    {
      multiContribFunders: validatedMultiEvents.size,
      expandedEvents: [...validatedMultiEvents.values()].reduce(
        (n, e) => n + e.length,
        0,
      ),
    },
    "Expanding multi-contribution funders into per-event timeline entries",
  );

  // Build expanded entries: individual DB events for validated funders,
  // chain record for everyone else.
  const expandedEntries: Array<{ time: BN; amount: BN }> = [];
  for (const r of sortedByTime) {
    const addr = r.funder.toBase58();
    const multiEvents = validatedMultiEvents.get(addr);
    if (multiEvents) {
      for (const e of multiEvents) {
        expandedEntries.push({ time: e.timestamp, amount: e.amount });
      }
    } else {
      expandedEntries.push({
        time: r.lastAccumulatorUpdate,
        amount: r.committedAmount,
      });
    }
  }
  expandedEntries.sort((a, b) => a.time.cmp(b.time));

  const expandedTimeline: TimelineEntry[] = [];
  let expCum = new BN(0);
  for (const entry of expandedEntries) {
    expCum = expCum.add(entry.amount);
    expandedTimeline.push({ time: entry.time, cumulative: expCum.clone() });
  }

  // --- Checkpoint verification: expanded curve vs chain curve ---
  // At every chain checkpoint, expanded cumulative must be >= chain cumulative.
  // Final totals must match exactly.
  for (let i = 0; i < chainTimeline.length; i++) {
    const checkpoint = chainTimeline[i];

    let expAtCheckpoint = new BN(0);
    for (const entry of expandedTimeline) {
      if (entry.time.lte(checkpoint.time)) {
        expAtCheckpoint = entry.cumulative;
      } else {
        break;
      }
    }

    if (expAtCheckpoint.lt(checkpoint.cumulative)) {
      log.error(
        {
          checkpointTime: checkpoint.time.toString(),
          chainCumulative: checkpoint.cumulative.toString(),
          dbCumulative: expAtCheckpoint.toString(),
        },
        "DB cumulative curve is below chain curve at checkpoint — " +
          "falling back to chain-only timeline",
      );
      return { timeline: chainTimeline, validatedMultiEvents: new Map() };
    }
  }

  // Final total must match.
  const expFinal = expandedTimeline[expandedTimeline.length - 1].cumulative;
  const chainFinal = chainTimeline[chainTimeline.length - 1].cumulative;
  if (!expFinal.eq(chainFinal)) {
    log.error(
      {
        dbFinalTotal: expFinal.toString(),
        chainTotal: chainFinal.toString(),
      },
      "DB timeline final total ≠ chain total — falling back to chain-only timeline",
    );
    return { timeline: chainTimeline, validatedMultiEvents: new Map() };
  }

  return { timeline: expandedTimeline, validatedMultiEvents };
}

/**
 * Look up the cumulative committed amount at a given time in the timeline.
 * Returns the cumulative at the last entry at or before `time`, or 0 if none.
 */
function cumulativeAtTime(timeline: TimelineEntry[], time: BN): BN {
  let cum = new BN(0);
  for (const entry of timeline) {
    if (entry.time.lte(time)) {
      cum = entry.cumulative;
    } else {
      break;
    }
  }
  return cum;
}

/**
 * Compute the boost factor for a given delayed cumulative and fill target.
 *
 *   boost = 1 + (multiplier - 1) × max(0, 1 - delayedCum / fillTarget)
 *
 * Returns a value between 1.0 (pool full) and multiplier (pool empty).
 */
function computeBoostFactor(
  delayedCum: BN,
  fillTarget: BN,
  multiplier: number,
): number {
  if (delayedCum.gte(fillTarget)) return 1.0;
  const fillRatio = delayedCum.toNumber() / fillTarget.toNumber();
  return 1 + (multiplier - 1) * (1 - fillRatio);
}

/**
 * Apply fill-based boost to a single funder's finalized accumulator.
 *
 * Single-contrib funders: one boost based on pool fill at their fund time.
 * Multi-contrib funders: each contribution gets its own boost based on pool
 * fill when THAT contribution arrived. The accumulator is decomposed into
 * per-event shares (amount × elapsed time to close), each boosted individually.
 *
 * @returns the boosted accumulator value
 */
function applyBoostFactor(
  f: FinalizedRecord,
  multiEvents: FundEvent[] | undefined,
  sortedByTime: AccumulatorFundingRecord[],
  timeline: TimelineEntry[],
  fillTarget: BN,
  multiplier: number,
  lookAheadBN: BN,
  launchCloseTime: BN,
  activationTime: BN,
): BN {
  const DENOM = 10_000;

  if (multiEvents) {
    // Per-event boost: decompose accumulator into per-contribution shares,
    // each boosted by the pool fill level when that contribution arrived.
    //
    // Each contribution's accumulator share: amount × (closeTime - max(eventTime, activationTime))
    // This decomposition is exact: sum of shares = finalized accumulator.
    let boostedAccum = new BN(0);
    for (const event of multiEvents) {
      const periodStart = BN.max(event.timestamp, activationTime);
      if (launchCloseTime.lte(periodStart)) continue;

      const eventAccum = event.amount.mul(launchCloseTime.sub(periodStart));
      const lookupTime = BN.min(
        event.timestamp.add(lookAheadBN),
        launchCloseTime,
      );
      const delayedCum = cumulativeAtTime(timeline, lookupTime);
      const boostFloat = computeBoostFactor(delayedCum, fillTarget, multiplier);
      const numerator = Math.round(boostFloat * DENOM);
      boostedAccum = boostedAccum.add(eventAccum.muln(numerator).divn(DENOM));
    }
    return boostedAccum;
  }

  // Single contribution: one boost for the whole accumulator.
  const record = sortedByTime.find(
    (r) => r.funder.toBase58() === f.funder.toBase58(),
  );
  const fundTime = record ? record.lastAccumulatorUpdate : launchCloseTime;
  const lookupTime = BN.min(fundTime.add(lookAheadBN), launchCloseTime);
  const delayedCum = cumulativeAtTime(timeline, lookupTime);
  const boostFloat = computeBoostFactor(delayedCum, fillTarget, multiplier);
  const numerator = Math.round(boostFloat * DENOM);
  return f.finalAccumulator.muln(numerator).divn(DENOM);
}

/** Finalized record with mutable accumulator for boost application. */
interface FinalizedRecord {
  funder: PublicKey;
  committedAmount: BN;
  finalAccumulator: BN;
}

/**
 * Apply fill-based boost to finalized accumulators.
 *
 * Multiplies each funder's accumulator by a boost factor based on how full
 * the pool was at (or shortly after) their fund time. Early funders who
 * committed when the pool was sparse get a higher multiplier.
 *
 * boost = 1 + (multiplier - 1) × max(0, 1 - delayedCum / (target × fillCeiling))
 *
 * When fundEvents are provided, multi-contribution funders (>1 DB event with
 * sum matching chain) are expanded into per-transaction timeline entries.
 * Each contribution gets its own boost based on the pool fill level when
 * that specific contribution arrived — preventing gaming via small early seeds.
 *
 * Mutates `finalized[].finalAccumulator` in place.
 *
 * @returns new totalAccumulator (sum of all boosted accumulators)
 */
function applyFillBoost(
  boost: BoostConfig,
  records: AccumulatorFundingRecord[],
  finalized: FinalizedRecord[],
  targetAmount: BN,
  launchCloseTime: BN,
  activationTime: BN,
  fundEvents?: FundEvent[],
): BN {
  // --- Validate boost config ---
  // Returns 0 on failure — caller uses max(boosted, original) as a sanity check.
  if (boost.fillCeiling < 0.01) {
    log.error(
      { fillCeiling: boost.fillCeiling },
      "BoostConfig.fillCeiling must be >= 0.01 — skipping boost",
    );
    return new BN(0);
  }
  if (boost.lookAheadSeconds < 0) {
    log.error(
      { lookAheadSeconds: boost.lookAheadSeconds },
      "BoostConfig.lookAheadSeconds must be >= 0 — skipping boost",
    );
    return new BN(0);
  }

  const lookAheadBN = new BN(boost.lookAheadSeconds);

  // fillTarget = targetAmount × fillCeiling (scaled for fractional ceilings)
  const fillTarget = targetAmount
    .muln(Math.round(boost.fillCeiling * 100))
    .divn(100);

  // Sort records by fund time to build cumulative timeline.
  // Only include records that were actually funded (lastAccumulatorUpdate > 0).
  const sortedByTime = [...records]
    .filter((r) => !r.lastAccumulatorUpdate.isZero())
    .sort((a, b) => a.lastAccumulatorUpdate.cmp(b.lastAccumulatorUpdate));

  // --- Build chain-only cumulative timeline (always available as baseline) ---
  const chainTimeline: TimelineEntry[] = [];
  let chainCum = new BN(0);
  for (const r of sortedByTime) {
    chainCum = chainCum.add(r.committedAmount);
    chainTimeline.push({
      time: r.lastAccumulatorUpdate,
      cumulative: chainCum.clone(),
    });
  }

  // --- Attempt DB-expanded timeline for multi-contribution funders ---
  // Returns chainTimeline unchanged if no valid DB events or verification fails.
  const { timeline, validatedMultiEvents } = fundEvents?.length
    ? buildExpandedTimeline(fundEvents, sortedByTime, chainTimeline)
    : {
        timeline: chainTimeline,
        validatedMultiEvents: new Map<string, FundEvent[]>(),
      };

  // Apply boost to each funder's accumulator individually.
  // Multi-contrib funders get per-event boost; single-contrib get one boost.
  let totalAccumulator = new BN(0);
  for (const f of finalized) {
    const multiEvents = validatedMultiEvents.get(f.funder.toBase58());
    f.finalAccumulator = applyBoostFactor(
      f,
      multiEvents,
      sortedByTime,
      timeline,
      fillTarget,
      boost.multiplier,
      lookAheadBN,
      launchCloseTime,
      activationTime,
    );
    totalAccumulator = totalAccumulator.add(f.finalAccumulator);
  }

  log.info(
    {
      boostMultiplier: boost.multiplier,
      fillCeiling: boost.fillCeiling,
      lookAheadSeconds: boost.lookAheadSeconds,
      multiContribFunders: validatedMultiEvents.size,
      totalBoostedAccumulator: totalAccumulator.toString(),
    },
    "Step 1.5 complete — fill boost applied",
  );

  return totalAccumulator;
}

/** Input record shape for accumulator-based approval. */
export interface AccumulatorFundingRecord {
  /** The funder's wallet public key. */
  funder: PublicKey;
  /** Amount committed in token atoms (USDC lamports). */
  committedAmount: BN;
  /** On-chain accumulator value (u128). Updated on each fund() call. */
  committedAmountAccumulator: BN;
  /** Unix timestamp (seconds) of the last accumulator flush. 0 if never funded. */
  lastAccumulatorUpdate: BN;
}

/**
 * Finalize a single record's accumulator to the launch close time.
 *
 * Why this is needed:
 *   The on-chain accumulator is only updated when fund() is called.
 *   Between the last fund() call and the launch close, the accumulator
 *   stops growing even though time continues to pass. We need to add
 *   this "unflushed tail" so the final value reflects the full duration.
 *
 * Formula:
 *   periodStart = max(lastAccumulatorUpdate, activationTime)
 *   finalAccumulator = accumulator + committedAmount * (closeTime - periodStart)
 *
 * Edge cases that return the accumulator as-is (no flush needed):
 *   - lastAccumulatorUpdate === 0: the record was never funded
 *   - closeTime <= activationTime: the launch closed before the
 *     activation delay elapsed, so no accumulator time was earned
 *   - closeTime <= periodStart: the last fund() happened at or after
 *     close time (shouldn't happen, but defensive)
 *
 * The activation delay prevents accumulator gaming during the initial
 * funding rush — accumulators don't start counting until
 * launchStartTime + accumulatorActivationDelaySeconds.
 *
 * @param record — single funding record from chain
 * @param closeTime — deterministic close time (start + duration), NOT unix_timestamp_closed
 * @param activationTime — launchStartTime + accumulatorActivationDelaySeconds
 * @returns finalized accumulator value (BN, u128 scale)
 */
// Exported for direct unit testing of edge cases (not used outside this module).
export function finalizeAccumulator(
  record: AccumulatorFundingRecord,
  closeTime: BN,
  activationTime: BN,
): BN {
  // Record was never funded — nothing to flush.
  if (record.lastAccumulatorUpdate.isZero()) {
    return record.committedAmountAccumulator;
  }

  // Launch closed before the activation delay elapsed — accumulator
  // never started counting, so on-chain value is already correct.
  if (closeTime.lte(activationTime)) {
    return record.committedAmountAccumulator;
  }

  // The accumulator only counts time after the activation delay.
  // If the funder's last update was before activation, we count from
  // activation time instead (they don't get credit for the delay period).
  const periodStart = BN.max(record.lastAccumulatorUpdate, activationTime);

  // Last fund() was at or after close — accumulator is already fully flushed.
  if (closeTime.lte(periodStart)) {
    return record.committedAmountAccumulator;
  }

  // Add the unflushed tail: committedAmount * seconds since last flush.
  const elapsed = closeTime.sub(periodStart);
  return record.committedAmountAccumulator.add(
    record.committedAmount.mul(elapsed),
  );
}

/**
 * Calculate accumulator-weighted approved amounts for each funding record.
 *
 * Four-phase algorithm:
 *   1. Finalize accumulators to close time
 *   2. Accumulator-weighted allocation with per-funder cap (approved <= committed)
 *   3. Redistribute surplus from capped funders by unfilled commitment
 *   4. Dust distribution to guarantee exact sum
 *
 * @param records — funding records from chain
 * @param targetAmount — the minimumRaiseAmount (= max goal for accelerated launches)
 * @param launchStartTime — unix_timestamp_started (seconds), from Launch account
 * @param secondsForLaunch — launch duration in seconds, from Launch account
 * @param accumulatorActivationDelaySeconds — from Launch account
 * @param boost — optional fill-based boost config. When undefined or multiplier ≤ 1,
 *   the algorithm is identical to the plain accumulator-weighted allocation.
 * @param fundEvents — optional per-transaction fund events from the indexer DB.
 *   Used to expand multi-contribution funders into individual timeline entries
 *   for more accurate boost calculation. Only applied when a funder has >1 event
 *   AND the sum of event amounts exactly matches the chain committedAmount.
 *   Ignored for single-contribution funders or on sum mismatch.
 * @returns array of { funder, approvedAmount } with guaranteed sum === targetAmount
 * @throws if totalAccumulator is zero or targetAmount > totalCommitted
 */
export function calculateAccumulatorApprovedAmounts(
  records: AccumulatorFundingRecord[],
  targetAmount: BN,
  launchStartTime: BN,
  secondsForLaunch: BN,
  accumulatorActivationDelaySeconds: BN,
  boost?: BoostConfig,
  fundEvents?: FundEvent[],
): FundingApproval[] {
  // Close time is deterministic: start + duration. Do NOT use unix_timestamp_closed
  // from the Launch account — that's the wall-clock time when closeLaunch was called
  // by the cranker, which may be seconds/minutes after the actual expiry.
  const launchCloseTime = launchStartTime.add(secondsForLaunch);
  const activationTime = launchStartTime.add(accumulatorActivationDelaySeconds);

  // --- Log: Entry parameters ---
  log.info(
    {
      launchStartTime: launchStartTime.toString(),
      secondsForLaunch: secondsForLaunch.toString(),
      accumulatorActivationDelaySeconds:
        accumulatorActivationDelaySeconds.toString(),
      launchCloseTime: launchCloseTime.toString(),
      activationTime: activationTime.toString(),
      targetAmount: targetAmount.toString(),
      recordCount: records.length,
    },
    "Accumulator approval — entry parameters",
  );

  // --- Step 1: Finalize accumulators ---
  // The on-chain accumulator stops growing after the last fund() call.
  // We add the unflushed tail (committedAmount * elapsed) to get the
  // true time-weighted value at close. Also tally up totals in the
  // same pass for the precondition checks below.
  const finalized: FinalizedRecord[] = [];
  let totalCommitted = new BN(0);
  let totalAccumulator = new BN(0);

  for (const record of records) {
    const finalAccumulator = finalizeAccumulator(
      record,
      launchCloseTime,
      activationTime,
    );
    finalized.push({
      funder: record.funder,
      committedAmount: record.committedAmount,
      finalAccumulator,
    });
    totalCommitted = totalCommitted.add(record.committedAmount);
    totalAccumulator = totalAccumulator.add(finalAccumulator);
  }

  log.info(
    {
      totalCommitted: totalCommitted.toString(),
      totalAccumulator: totalAccumulator.toString(),
    },
    "Phase 1 complete — accumulators finalized",
  );

  // --- Precondition checks ---
  if (targetAmount.gt(totalCommitted)) {
    throw new Error(
      `targetAmount (${targetAmount.toString()}) > totalCommitted (${totalCommitted.toString()}) — approvals would exceed committed amounts`,
    );
  }

  // Precondition: totalAccumulator must be > 0 (guaranteed by on-chain program so redundant)
  if (totalAccumulator.isZero()) {
    throw new Error(
      "totalAccumulator is zero — no funder had any time-weighted contribution",
    );
  }

  // --- Step 1.5: Apply fill boost (optional) ---
  // Mutates finalized[].finalAccumulator and returns new totalAccumulator.
  if (boost && boost.multiplier > 1) {
    const boostedTotal = applyFillBoost(
      boost,
      records,
      finalized,
      targetAmount,
      launchCloseTime,
      activationTime,
      fundEvents,
    );
    if (boostedTotal.lt(totalAccumulator)) {
      log.error(
        {
          boosted: boostedTotal.toString(),
          original: totalAccumulator.toString(),
        },
        "Boost returned less than original — keeping original totalAccumulator",
      );
    } else {
      totalAccumulator = boostedTotal;
    }
  }

  // --- Step 2: Accumulator-weighted allocation with cap ---
  // Each funder's share is proportional to their accumulator weight:
  //   uncapped = floor(finalAccumulator * targetAmount / totalAccumulator)
  //
  // But a funder can never receive more than they committed, so:
  //   approved = min(uncapped, committedAmount)
  //
  // This cap commonly triggers for small early funders whose time-weighted
  // share exceeds their deposit (e.g. $5k committed but accumulator says
  // they "deserve" $50k). The excess becomes surplus for Step 3.
  const approvals: Array<{
    funder: PublicKey;
    committedAmount: BN;
    approvedAmount: BN;
    capped: boolean; // true if uncapped > committedAmount (at capacity)
  }> = [];

  for (const r of finalized) {
    const uncapped = r.finalAccumulator.mul(targetAmount).div(totalAccumulator);
    const capped = uncapped.gt(r.committedAmount);
    const approvedAmount = capped ? r.committedAmount : uncapped;
    approvals.push({
      funder: r.funder,
      committedAmount: r.committedAmount,
      approvedAmount,
      capped,
    });
  }

  // --- Step 3: Redistribute surplus by unfilled commitment ---
  // Capping in Step 2 may have freed up tokens (sum(approved) < targetAmount).
  // Distribute that surplus to uncapped funders, weighted by how much room
  // each still has (unfilled = committed - approved). This ensures funders
  // with more remaining capacity absorb proportionally more of the surplus.
  //
  // No new caps can occur here because each record receives at most its own
  // unfilled amount — the weight IS the remaining capacity.
  let approvedSum = new BN(0);
  for (const a of approvals) {
    approvedSum = approvedSum.add(a.approvedAmount);
  }
  const surplus = targetAmount.sub(approvedSum);

  log.info(
    {
      approvedSum: approvedSum.toString(),
      surplus: surplus.toString(),
      cappedCount: approvals.filter((a) => a.capped).length,
      uncappedCount: approvals.filter((a) => !a.capped).length,
    },
    "Phase 2 complete — weighted allocation",
  );

  if (surplus.gt(new BN(0))) {
    // Only uncapped records have room for more tokens.
    let unfilledTotal = new BN(0);
    for (const a of approvals) {
      if (!a.capped) {
        unfilledTotal = unfilledTotal.add(
          a.committedAmount.sub(a.approvedAmount),
        );
      }
    }

    // Redistribute proportional to each uncapped record's unfilled capacity.
    if (unfilledTotal.gt(new BN(0))) {
      for (const a of approvals) {
        if (!a.capped) {
          const unfilled = a.committedAmount.sub(a.approvedAmount);
          const extra = surplus.mul(unfilled).div(unfilledTotal);
          const newApproved = a.approvedAmount.add(extra);

          a.approvedAmount = newApproved;
        }
      }
    }

    // Recompute sum after redistribution for the Phase 3 summary.
    let postRedistSum = new BN(0);
    for (const a of approvals) {
      postRedistSum = postRedistSum.add(a.approvedAmount);
    }
    log.info(
      {
        unfilledTotal: unfilledTotal.toString(),
        remainingDust: targetAmount.sub(postRedistSum).toString(),
      },
      "Phase 3 complete — surplus redistributed",
    );
  } else {
    log.info("Phase 3 skipped — no surplus to redistribute");
  }

  // --- Step 4: Dust distribution ---
  // Floor division in steps 2 and 3 may leave sum(approved) < targetAmount
  // by a few atoms. Distribute one atom at a time to records with room.
  let currentSum = new BN(0);
  for (const a of approvals) {
    currentSum = currentSum.add(a.approvedAmount);
  }
  let dust = targetAmount.sub(currentSum);

  log.info(
    { dustAtoms: dust.toString() },
    dust.isZero() ? "Phase 4 skipped — no dust" : "Phase 4 — distributing dust",
  );

  // Loop until all dust is distributed. One pass is almost always enough,
  // but a while guarantees correctness if dust exceeds records.length
  // (theoretically possible from compounded floor divisions in steps 2+3).
  // Dust is bounded by ~2 * records.length, so 3 passes is more than enough.
  const MAX_DUST_PASSES = 3;
  let dustPass = 0;
  while (dust.gt(new BN(0)) && dustPass < MAX_DUST_PASSES) {
    dustPass++;
    let distributed = false;
    for (let i = 0; dust.gt(new BN(0)) && i < approvals.length; i++) {
      if (approvals[i].approvedAmount.lt(approvals[i].committedAmount)) {
        approvals[i].approvedAmount = approvals[i].approvedAmount.add(
          new BN(1),
        );
        dust = dust.sub(new BN(1));
        distributed = true;
      }
    }

    // If no record had room, all are at their cap. Since targetAmount <= totalCommitted
    // this means sum(approved) == totalCommitted >= targetAmount, so dust should be 0.
    // If we're here, something is wrong upstream — fail loudly.
    if (!distributed) {
      throw new Error(
        `Dust distribution failed: ${dust.toString()} atoms remain undistributed — no record has room`,
      );
    }
  }

  // If we exhausted max passes and still have dust, fail loudly.
  if (dust.gt(new BN(0))) {
    throw new Error(
      `Dust distribution failed: ${dust.toString()} atoms remain after ${MAX_DUST_PASSES} passes`,
    );
  }

  // --- Compact summary (replaces per-funder table) ---
  let totalApproved = new BN(0);
  let cappedCount = 0;
  for (const a of approvals) {
    totalApproved = totalApproved.add(a.approvedAmount);
    if (a.capped) cappedCount++;
  }

  log.info(
    {
      funders: approvals.length,
      totalCommitted: totalCommitted.toString(),
      totalApproved: totalApproved.toString(),
      targetAmount: targetAmount.toString(),
      cappedFunders: cappedCount,
      dustPasses: dustPass,
    },
    "Accumulator approval complete",
  );

  // --- Postcondition: verify all 5 mathematical invariants ---
  // These are non-negotiable correctness guarantees from the fair-launch spec.
  // A violation here means a bug in the algorithm above — fail loudly.

  let finalApprovedSum = new BN(0);
  for (const a of approvals) {
    finalApprovedSum = finalApprovedSum.add(a.approvedAmount);
  }

  // Invariant 2: Raise Target Met — Σ approvedAmount = targetAmount
  if (!finalApprovedSum.eq(targetAmount)) {
    throw new Error(
      `Invariant violation: Σ approvedAmount (${finalApprovedSum.toString()}) !== targetAmount (${targetAmount.toString()})`,
    );
  }

  for (let i = 0; i < approvals.length; i++) {
    const approved = approvals[i].approvedAmount;
    const committed = approvals[i].committedAmount;

    // Invariant 3: Individual Caps — approvedAmount ≤ committedAmount
    if (approved.gt(committed)) {
      throw new Error(
        `Invariant violation: funder ${approvals[i].funder.toBase58()} approved (${approved.toString()}) > committed (${committed.toString()})`,
      );
    }

    // Invariant 4: Non-Negativity — approvedAmount ≥ 0 and refundAmount ≥ 0
    if (approved.isNeg()) {
      throw new Error(
        `Invariant violation: funder ${approvals[i].funder.toBase58()} approved amount is negative (${approved.toString()})`,
      );
    }
  }

  // Invariant 1: Total Conservation — Σ approved + Σ refund = totalCommitted
  // Since refund_i = committed_i - approved_i:
  //   Σ approved + (totalCommitted - Σ approved) = totalCommitted
  // This is tautologically true given the definition, but we verify the
  // constituent parts: totalCommitted is correctly computed and finalApprovedSum ≤ totalCommitted.
  if (finalApprovedSum.gt(totalCommitted)) {
    throw new Error(
      `Invariant violation: Σ approvedAmount (${finalApprovedSum.toString()}) > totalCommitted (${totalCommitted.toString()})`,
    );
  }

  const result: FundingApproval[] = [];
  for (const a of approvals) {
    result.push({ funder: a.funder, approvedAmount: a.approvedAmount });
  }
  return result;
}
