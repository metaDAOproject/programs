/**
 * Rip Cars allocation — congestion-game Nash equilibrium.
 *
 * Two roads share a fixed pool (congestion):
 *   - Ownership road: water-fills `ownershipSplit` of the pool by ownership SCORE
 *     among whoever picks it (capped at committed).
 *   - Accumulator road: splits the rest by accelerated-cranker ACCUMULATOR WEIGHT
 *     among whoever picks it (capped at committed).
 *
 * Each scored funder myopically best-responds to current congestion; unscored
 * funders can only ride the accumulator road. Sequential best-response converges
 * to an ε-Nash (same game as nash_equilibrium_sim.ts / nash_equilibrium_live.ts).
 *
 * Accumulator weights are the full-pool accelerated-cranker approved amounts
 * (ratios only matter for the split among accumulator riders).
 */
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import type { FundingApproval } from "./ac/fundingApproval.js";

const USDC_SCALAR = 1_000_000n;

// ── types ───────────────────────────────────────────────────────────────────

/** On-chain funding record fields needed by the allocator. */
export interface RipCarsFundingRecord {
  funder: PublicKey;
  committedAmount: BN;
  committedAmountAccumulator: BN;
  lastAccumulatorUpdate: BN;
  /** Ownership score (0 if unscored). */
  score: number;
}

export interface FundEvent {
  funderAddr: string;
  amount: BN;
  timestamp: BN;
}

export interface BoostConfig {
  multiplier: number;
  fillCeiling: number;
  lookAheadSeconds: number;
}

/** Which road the funder rides at equilibrium. */
export type RoadKind = "ownership" | "accumulator";

export interface AllocationLine {
  funder: PublicKey;
  committedAmount: BN;
  approvedAmount: BN;
  kind: RoadKind;
  score: number;
  /** Accumulator weight used in the congestion game (atoms). */
  accumulatorWeight: BN;
  lastAccumulatorUpdate: BN;
  firstFundTime: BN;
}

export interface AllocationResult {
  lines: AllocationLine[];
  approvals: FundingApproval[];
  /** Funders capped when computing accumulator weights. */
  cappedCount: number;
  ownershipCount: number;
  /** Best-response rounds until ε-Nash (or max). */
  rounds: number;
  atNash: boolean;
  maxGain: number;
}

export type NashStartMode = "acc" | "own" | "rand";

export interface AllocationConfig {
  totalAllocation: BN;
  /** Fraction of the pool budgeted to the ownership road (HTML "Ownership split"). */
  ownershipSplit: number;
  /** Switch only if alternate road pays more than current by this many USDC dollars. */
  epsilon: number;
  /**
   * Per-round flip probability for unhappy agents (HTML "Reactivity").
   * Simultaneous stochastic BR — same as nash_equilibrium_sim.ts Solve.
   */
  reactivity: number;
  /** Initial road assignment before best-response. HTML default: rand. */
  startMode: NashStartMode;
  /** RNG seed (HTML default 20260723). Used for rand start + stochastic flips. */
  seed: number;
  boost: BoostConfig;
  launchStartTime: BN;
  secondsForLaunch: BN;
  accumulatorActivationDelaySeconds: BN;
}

// ── bigint helpers ──────────────────────────────────────────────────────────

const bmax = (a: bigint, b: bigint): bigint => (a > b ? a : b);
const bmin = (a: bigint, b: bigint): bigint => (a < b ? a : b);
const bnToBig = (n: BN): bigint => BigInt(n.toString());
const bigToBn = (n: bigint): BN => new BN(n.toString());

interface InternalRecord {
  address: string;
  funder: PublicKey;
  committedAtoms: bigint;
  accumulator: bigint;
  lastUpdate: bigint;
  score: number;
}

interface InternalFundEvent {
  funderAddr: string;
  amount: bigint;
  timestamp: bigint;
}

// ── ACCUMULATOR WEIGHTS (faithful BigInt port) ──────────────────────────────

function finalizeAccumulator(
  r: InternalRecord,
  closeTime: bigint,
  activationTime: bigint,
): bigint {
  if (r.lastUpdate === 0n) return r.accumulator;
  if (closeTime <= activationTime) return r.accumulator;
  const periodStart = bmax(r.lastUpdate, activationTime);
  if (closeTime <= periodStart) return r.accumulator;
  return r.accumulator + r.committedAtoms * (closeTime - periodStart);
}

interface TimelineEntry {
  time: bigint;
  cumulative: bigint;
}

function cumulativeAtTime(timeline: TimelineEntry[], time: bigint): bigint {
  let cum = 0n;
  for (const e of timeline) {
    if (e.time <= time) cum = e.cumulative;
    else break;
  }
  return cum;
}

function computeBoostFactor(
  delayedCum: bigint,
  fillTarget: bigint,
  multiplier: number,
): number {
  if (delayedCum >= fillTarget) return 1;
  const fillRatio = Number(delayedCum) / Number(fillTarget);
  return 1 + (multiplier - 1) * (1 - fillRatio);
}

function buildTimeline(
  records: InternalRecord[],
  fundEvents: InternalFundEvent[],
): {
  timeline: TimelineEntry[];
  validatedMulti: Map<string, InternalFundEvent[]>;
} {
  const sorted = records
    .filter((r) => r.lastUpdate !== 0n)
    .sort((a, b) => Number(a.lastUpdate - b.lastUpdate));
  const chain: TimelineEntry[] = [];
  let cc = 0n;
  for (const r of sorted) {
    cc += r.committedAtoms;
    chain.push({ time: r.lastUpdate, cumulative: cc });
  }

  const byFunder = new Map<string, InternalFundEvent[]>();
  for (const e of fundEvents)
    (
      byFunder.get(e.funderAddr) ??
      byFunder.set(e.funderAddr, []).get(e.funderAddr)!
    ).push(e);
  const validatedMulti = new Map<string, InternalFundEvent[]>();
  for (const [addr, evs] of byFunder) {
    if (evs.length <= 1) continue;
    const rec = sorted.find((r) => r.address === addr);
    if (!rec) continue;
    const sum = evs.reduce((s, e) => s + e.amount, 0n);
    if (sum !== rec.committedAtoms) continue;
    if (evs.some((e) => e.timestamp > rec.lastUpdate)) continue;
    validatedMulti.set(
      addr,
      [...evs].sort((a, b) => Number(a.timestamp - b.timestamp)),
    );
  }
  if (validatedMulti.size === 0) return { timeline: chain, validatedMulti };

  const expandedEntries: Array<{ time: bigint; amount: bigint }> = [];
  for (const r of sorted) {
    const m = validatedMulti.get(r.address);
    if (m)
      for (const e of m)
        expandedEntries.push({ time: e.timestamp, amount: e.amount });
    else expandedEntries.push({ time: r.lastUpdate, amount: r.committedAtoms });
  }
  expandedEntries.sort((a, b) => Number(a.time - b.time));
  const expanded: TimelineEntry[] = [];
  let ec = 0n;
  for (const e of expandedEntries) {
    ec += e.amount;
    expanded.push({ time: e.time, cumulative: ec });
  }
  for (const cp of chain)
    if (cumulativeAtTime(expanded, cp.time) < cp.cumulative)
      return { timeline: chain, validatedMulti: new Map() };
  if (
    expanded[expanded.length - 1].cumulative !==
    chain[chain.length - 1].cumulative
  ) {
    return { timeline: chain, validatedMulti: new Map() };
  }
  return { timeline: expanded, validatedMulti };
}

interface Finalized {
  address: string;
  committedAtoms: bigint;
  finalAccumulator: bigint;
}

function applyBoost(
  records: InternalRecord[],
  finalized: Finalized[],
  target: bigint,
  closeTime: bigint,
  activationTime: bigint,
  fundEvents: InternalFundEvent[],
  boost: BoostConfig,
): bigint {
  const DENOM = 10_000n;
  const fillTarget =
    (target * BigInt(Math.round(boost.fillCeiling * 100))) / 100n;
  const lookAhead = BigInt(boost.lookAheadSeconds);
  const { timeline, validatedMulti } = fundEvents.length
    ? buildTimeline(records, fundEvents)
    : {
        timeline: [] as TimelineEntry[],
        validatedMulti: new Map<string, InternalFundEvent[]>(),
      };
  const recByAddr = new Map(records.map((r) => [r.address, r]));
  let total = 0n;
  for (const f of finalized) {
    const multi = validatedMulti.get(f.address);
    if (multi) {
      let boosted = 0n;
      for (const ev of multi) {
        const periodStart = bmax(ev.timestamp, activationTime);
        if (closeTime <= periodStart) continue;
        const eventAccum = ev.amount * (closeTime - periodStart);
        const lookupTime = bmin(ev.timestamp + lookAhead, closeTime);
        const boostFloat = computeBoostFactor(
          cumulativeAtTime(timeline, lookupTime),
          fillTarget,
          boost.multiplier,
        );
        boosted +=
          (eventAccum * BigInt(Math.round(boostFloat * Number(DENOM)))) / DENOM;
      }
      f.finalAccumulator = boosted;
    } else {
      const rec = recByAddr.get(f.address);
      const fundTime = rec ? rec.lastUpdate : closeTime;
      const lookupTime = bmin(fundTime + lookAhead, closeTime);
      const boostFloat = computeBoostFactor(
        cumulativeAtTime(timeline, lookupTime),
        fillTarget,
        boost.multiplier,
      );
      f.finalAccumulator =
        (f.finalAccumulator * BigInt(Math.round(boostFloat * Number(DENOM)))) /
        DENOM;
    }
    total += f.finalAccumulator;
  }
  return total;
}

/** Full-pool accumulator approval — used as each funder's congestion-game weight. */
function accumulatorApproved(
  records: InternalRecord[],
  target: bigint,
  startTime: bigint,
  duration: bigint,
  activationDelay: bigint,
  fundEvents: InternalFundEvent[],
  boost: BoostConfig,
): { approved: Map<string, bigint>; cappedCount: number } {
  const closeTime = startTime + duration;
  const activationTime = startTime + activationDelay;
  const finalized: Finalized[] = [];
  let totalCommitted = 0n;
  let totalAcc = 0n;
  for (const r of records) {
    const fa = finalizeAccumulator(r, closeTime, activationTime);
    finalized.push({
      address: r.address,
      committedAtoms: r.committedAtoms,
      finalAccumulator: fa,
    });
    totalCommitted += r.committedAtoms;
    totalAcc += fa;
  }
  if (target > totalCommitted)
    throw new Error(`target ${target} > totalCommitted ${totalCommitted}`);
  if (totalAcc === 0n) throw new Error("totalAccumulator is zero");

  if (boost.multiplier > 1) {
    const boosted = applyBoost(
      records,
      finalized,
      target,
      closeTime,
      activationTime,
      fundEvents,
      boost,
    );
    if (boosted >= totalAcc) totalAcc = boosted;
  }

  const rows = finalized.map((f) => {
    const uncapped = (f.finalAccumulator * target) / totalAcc;
    const capped = uncapped > f.committedAtoms;
    return {
      address: f.address,
      committed: f.committedAtoms,
      approved: capped ? f.committedAtoms : uncapped,
      capped,
    };
  });
  let surplus = target - rows.reduce((s, r) => s + r.approved, 0n);
  if (surplus > 0n) {
    const unfilledTotal = rows
      .filter((r) => !r.capped)
      .reduce((s, r) => s + (r.committed - r.approved), 0n);
    if (unfilledTotal > 0n)
      for (const r of rows)
        if (!r.capped)
          r.approved += (surplus * (r.committed - r.approved)) / unfilledTotal;
  }
  let dust = target - rows.reduce((s, r) => s + r.approved, 0n);
  let pass = 0;
  while (dust > 0n && pass < 3) {
    pass++;
    let did = false;
    for (let i = 0; dust > 0n && i < rows.length; i++)
      if (rows[i].approved < rows[i].committed) {
        rows[i].approved += 1n;
        dust -= 1n;
        did = true;
      }
    if (!did)
      throw new Error(`dust distribution failed: ${dust} atoms with no room`);
  }
  const finalSum = rows.reduce((s, r) => s + r.approved, 0n);
  if (finalSum !== target)
    throw new Error(`INVARIANT: sum approved ${finalSum} != target ${target}`);
  for (const r of rows)
    if (r.approved > r.committed)
      throw new Error(`INVARIANT: ${r.address} approved > committed`);
  return {
    approved: new Map(rows.map((r) => [r.address, r.approved])),
    cappedCount: rows.filter((r) => r.capped).length,
  };
}

// ── NASH CONGESTION GAME (port of nash_equilibrium_sim.ts) ───────────────────

interface Agent {
  address: string;
  score: number;
  committed: number;
  weight: number;
}

/** Mulberry-compatible LCG matching the HTML sim seed. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Water-fill ownership budget among ownership riders by score, capped at committed. */
function ownAlloc(
  agents: Agent[],
  onOwn: boolean[],
  ownBudget: number,
): { alloc: Float64Array; lam: number } {
  const idx: number[] = [];
  for (let i = 0; i < agents.length; i++)
    if (onOwn[i] && agents[i].score > 0) idx.push(i);
  idx.sort(
    (x, y) =>
      agents[x].committed / agents[x].score -
      agents[y].committed / agents[y].score,
  );
  let rem = ownBudget;
  let act = 0;
  for (const i of idx) act += agents[i].score;
  const alloc = new Float64Array(agents.length);
  let lam = 0;
  let from = idx.length;
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    if (act <= 0) break;
    const thr = agents[i].committed / agents[i].score;
    const cand = rem / act;
    if (cand <= thr) {
      lam = cand;
      from = k;
      break;
    }
    alloc[i] = agents[i].committed;
    rem -= agents[i].committed;
    act -= agents[i].score;
  }
  for (let k = from; k < idx.length; k++) {
    const i = idx[k];
    alloc[i] = agents[i].score * lam;
  }
  return { alloc, lam };
}

/** Split accumulator budget among accumulator riders by weight, capped at committed. */
function accAlloc(
  agents: Agent[],
  onOwn: boolean[],
  accBudget: number,
): { alloc: Float64Array; rate: number } {
  let sum = 0;
  for (let i = 0; i < agents.length; i++)
    if (!onOwn[i]) sum += agents[i].weight;
  const alloc = new Float64Array(agents.length);
  for (let i = 0; i < agents.length; i++) {
    if (!onOwn[i])
      alloc[i] =
        sum > 0
          ? Math.min(agents[i].committed, (agents[i].weight / sum) * accBudget)
          : 0;
  }
  return { alloc, rate: sum > 0 ? accBudget / sum : 0 };
}

function maxSwitchGain(
  agents: Agent[],
  onOwn: boolean[],
  ownBudget: number,
  accBudget: number,
  eps: number,
): {
  unhappy: number;
  maxGain: number;
  best: number; // agent index with largest myopic gain (-1 if none)
} {
  const { alloc: oa, lam } = ownAlloc(agents, onOwn, ownBudget);
  const { alloc: aa, rate } = accAlloc(agents, onOwn, accBudget);
  let unhappy = 0;
  let maxGain = 0;
  let best = -1;
  for (let i = 0; i < agents.length; i++) {
    if (agents[i].score <= 0) continue;
    const cur = onOwn[i] ? oa[i] : aa[i];
    const alt = onOwn[i]
      ? Math.min(agents[i].committed, agents[i].weight * rate)
      : Math.min(agents[i].committed, agents[i].score * lam);
    const gain = alt - cur;
    if (gain > eps) unhappy++;
    if (gain > maxGain) {
      maxGain = gain;
      best = i;
    }
  }
  return { unhappy, maxGain, best };
}

/** Pack road assignment for cycle detection during polish. */
function roadKey(onOwn: boolean[]): string {
  // Compact bitstring — 581 funders fits fine as a string of 0/1.
  let s = "";
  for (let i = 0; i < onOwn.length; i++) s += onOwn[i] ? "1" : "0";
  return s;
}

/**
 * Simultaneous stochastic myopic best-response — exact port of
 * nash_equilibrium_sim.ts `step` + `solve`, then a greedy single-flip polish
 * so we actually reach ε-Nash (stochastic alone can chatter near equilibrium).
 */
function solveNash(
  agents: Agent[],
  pool: number,
  ownFrac: number,
  eps: number,
  reactivity: number,
  startMode: NashStartMode,
  seed: number,
  maxRounds = 2000,
): {
  onOwn: boolean[];
  payouts: Float64Array;
  rounds: number;
  atNash: boolean;
  maxGain: number;
} {
  const ownBudget = ownFrac * pool;
  const accBudget = pool - ownBudget;
  const rnd = makeRng(seed);
  const onOwn = agents.map((a) => {
    if (a.score <= 0) return false;
    if (startMode === "own") return true;
    if (startMode === "acc") return false;
    return rnd() < 0.5;
  });

  for (let i = 0; i < agents.length; i++)
    if (agents[i].score <= 0) onOwn[i] = false;

  // Phase 1: HTML-identical simultaneous stochastic BR.
  let rounds = 0;
  for (; rounds < maxRounds; rounds++) {
    const { alloc: oa, lam } = ownAlloc(agents, onOwn, ownBudget);
    const { alloc: aa, rate } = accAlloc(agents, onOwn, accBudget);
    let unhappy = 0;
    const flips: number[] = [];
    for (let i = 0; i < agents.length; i++) {
      if (agents[i].score <= 0) {
        onOwn[i] = false;
        continue;
      }
      const cur = onOwn[i] ? oa[i] : aa[i];
      const altOwn = Math.min(agents[i].committed, agents[i].score * lam);
      const altAcc = Math.min(agents[i].committed, agents[i].weight * rate);
      const alt = onOwn[i] ? altAcc : altOwn;
      if (alt > cur + eps) {
        unhappy++;
        if (rnd() < reactivity) flips.push(i);
      }
    }
    if (unhappy === 0) break;
    for (const i of flips) onOwn[i] = !onOwn[i];
  }

  // Phase 2: greedy myopic polish — flip only the single most-unhappy agent
  // each round. Breaks the chatter the HTML's stochastic Solve sometimes
  // escapes by luck, and finishes when max gain is still tens of dollars.
  const seen = new Set<string>();
  const polishCap = agents.length * 4;
  let cycled = false;
  for (let p = 0; p < polishCap; p++) {
    const { unhappy, maxGain, best } = maxSwitchGain(
      agents,
      onOwn,
      ownBudget,
      accBudget,
      eps,
    );
    if (unhappy === 0 || best < 0 || maxGain <= eps) break;
    const key = roadKey(onOwn);
    if (seen.has(key)) {
      cycled = true;
      break;
    }
    seen.add(key);
    onOwn[best] = !onOwn[best];
    rounds++;
  }

  // Phase 3: if greedy cycled, only keep flips that strictly reduce the
  // unhappy count (hill-climb on the HTML's own settlement metric).
  if (
    cycled ||
    maxSwitchGain(agents, onOwn, ownBudget, accBudget, eps).unhappy > 0
  ) {
    const taboo = new Set<number>();
    for (let p = 0; p < polishCap; p++) {
      const before = maxSwitchGain(agents, onOwn, ownBudget, accBudget, eps);
      if (before.unhappy === 0) break;
      // Prefer the best non-taboo flip.
      const { alloc: oa, lam } = ownAlloc(agents, onOwn, ownBudget);
      const { alloc: aa, rate } = accAlloc(agents, onOwn, accBudget);
      let pick = -1;
      let pickGain = 0;
      for (let i = 0; i < agents.length; i++) {
        if (agents[i].score <= 0 || taboo.has(i)) continue;
        const cur = onOwn[i] ? oa[i] : aa[i];
        const alt = onOwn[i]
          ? Math.min(agents[i].committed, agents[i].weight * rate)
          : Math.min(agents[i].committed, agents[i].score * lam);
        const gain = alt - cur;
        if (gain > eps && gain > pickGain) {
          pickGain = gain;
          pick = i;
        }
      }
      if (pick < 0) break;
      onOwn[pick] = !onOwn[pick];
      const after = maxSwitchGain(agents, onOwn, ownBudget, accBudget, eps);
      if (after.unhappy >= before.unhappy) {
        onOwn[pick] = !onOwn[pick]; // revert
        taboo.add(pick);
      } else {
        taboo.clear();
        rounds++;
      }
    }
  }

  // Final payouts include per-road dust so each road spends its full budget
  // (commit caps permitting) — HTML sim leaves leftover on the table.
  const payouts = allocateWithRoadDust(agents, onOwn, ownBudget, accBudget);

  const { unhappy, maxGain } = maxSwitchGain(
    agents,
    onOwn,
    ownBudget,
    accBudget,
    eps,
  );
  return { onOwn, payouts, rounds, atNash: unhappy === 0, maxGain };
}

/**
 * Allocate each road's budget, then dust unused remainder onto riders on that
 * same road who still have commit headroom (pro-rata). Mirrors the cranker's
 * surplus + dust passes, scoped per road so ownership/accumulator budgets
 * stay separate.
 */
function allocateWithRoadDust(
  agents: Agent[],
  onOwn: boolean[],
  ownBudget: number,
  accBudget: number,
): Float64Array {
  const { alloc: oa } = ownAlloc(agents, onOwn, ownBudget);
  const { alloc: aa } = accAlloc(agents, onOwn, accBudget);
  const out = new Float64Array(agents.length);
  for (let i = 0; i < agents.length; i++) out[i] = onOwn[i] ? oa[i] : aa[i];

  dustRoad(out, agents, onOwn, true, ownBudget);
  dustRoad(out, agents, onOwn, false, accBudget);
  return out;
}

/** Redistribute a road's unspent budget among its riders by commit headroom. */
function dustRoad(
  alloc: Float64Array,
  agents: Agent[],
  onOwn: boolean[],
  ownershipRoad: boolean,
  budget: number,
): void {
  const riders: number[] = [];
  for (let i = 0; i < agents.length; i++) {
    if (onOwn[i] === ownershipRoad) riders.push(i);
  }
  if (riders.length === 0) return;

  for (let iter = 0; iter < 50; iter++) {
    for (const i of riders)
      alloc[i] = Math.min(agents[i].committed, Math.max(0, alloc[i]));
    const spent = riders.reduce((s, i) => s + alloc[i], 0);
    const diff = budget - spent;
    if (Math.abs(diff) < 1e-9) break;
    if (diff > 0) {
      const head = riders.map((i) =>
        Math.max(0, agents[i].committed - alloc[i]),
      );
      const ht = head.reduce((s, v) => s + v, 0);
      if (ht <= 1e-9) break; // all capped — leftover handled cross-road below
      for (let k = 0; k < riders.length; k++)
        alloc[riders[k]] += (diff * head[k]) / ht;
    } else {
      const slack = riders.map((i) => Math.max(0, alloc[i]));
      const st = slack.reduce((s, v) => s + v, 0);
      if (st <= 1e-9) break;
      for (let k = 0; k < riders.length; k++)
        alloc[riders[k]] -= (-diff * slack[k]) / st;
    }
  }
}

/** Round dollar amounts to atoms and dust-fix so Σ == target and approved <= committed. */
function dollarsToAtomsExact(
  dollars: Map<string, number>,
  committed: Map<string, bigint>,
  addrs: string[],
  target: bigint,
): Map<string, bigint> {
  const atoms = new Map<string, bigint>();
  for (const a of addrs) {
    const c = committed.get(a) ?? 0n;
    const raw = BigInt(Math.round((dollars.get(a) ?? 0) * Number(USDC_SCALAR)));
    atoms.set(a, bmin(c, bmax(0n, raw)));
  }
  let sum = addrs.reduce((s, a) => s + atoms.get(a)!, 0n);
  let diff = target - sum;
  if (diff > 0n) {
    let pass = 0;
    while (diff > 0n && pass < 5) {
      pass++;
      let did = false;
      for (const a of addrs) {
        if (diff <= 0n) break;
        const room = (committed.get(a) ?? 0n) - atoms.get(a)!;
        if (room > 0n) {
          atoms.set(a, atoms.get(a)! + 1n);
          diff -= 1n;
          did = true;
        }
      }
      if (!did)
        throw new Error(`atom dust under-fill: ${diff} atoms with no room`);
    }
  } else if (diff < 0n) {
    let pass = 0;
    while (diff < 0n && pass < 5) {
      pass++;
      let did = false;
      for (const a of addrs) {
        if (diff >= 0n) break;
        if (atoms.get(a)! > 0n) {
          atoms.set(a, atoms.get(a)! - 1n);
          diff += 1n;
          did = true;
        }
      }
      if (!did)
        throw new Error(
          `atom dust over-fill: ${-diff} atoms with nothing to reclaim`,
        );
    }
  }
  sum = addrs.reduce((s, a) => s + atoms.get(a)!, 0n);
  if (sum !== target)
    throw new Error(`INVARIANT: atom sum ${sum} != target ${target}`);
  for (const a of addrs) {
    if (atoms.get(a)! > (committed.get(a) ?? 0n))
      throw new Error(`INVARIANT: ${a} approved > committed`);
  }
  return atoms;
}

/**
 * Cross-road fill: if a road couldn't absorb its budget (everyone capped),
 * move the leftover onto the other road's riders by headroom so Σ == pool
 * before atom conversion.
 */
function fillToPool(
  payouts: Float64Array,
  agents: Agent[],
  pool: number,
): Float64Array {
  const out = Float64Array.from(payouts);
  for (let iter = 0; iter < 50; iter++) {
    for (let i = 0; i < agents.length; i++)
      out[i] = Math.min(agents[i].committed, Math.max(0, out[i]));
    const total = out.reduce((s, v) => s + v, 0);
    const diff = pool - total;
    if (Math.abs(diff) < 1e-6) break;
    if (diff > 0) {
      const head = agents.map((a, i) => Math.max(0, a.committed - out[i]));
      const ht = head.reduce((s, v) => s + v, 0);
      if (ht <= 1e-9) break;
      for (let i = 0; i < agents.length; i++) out[i] += (diff * head[i]) / ht;
    } else {
      const slack = out.map((v) => Math.max(0, v));
      const st = slack.reduce((s, v) => s + v, 0);
      if (st <= 1e-9) break;
      for (let i = 0; i < agents.length; i++) out[i] -= (-diff * slack[i]) / st;
    }
  }
  return out;
}

// ── public API ──────────────────────────────────────────────────────────────

/**
 * Compute Rip Cars approvals via congestion-game Nash equilibrium.
 *
 * @returns per-funder lines + approvals with Σ approved === totalAllocation
 */
export function computeAllocation(
  records: RipCarsFundingRecord[],
  fundEvents: FundEvent[],
  config: AllocationConfig,
): AllocationResult {
  if (records.length === 0) throw new Error("No funding records");
  if (config.ownershipSplit < 0 || config.ownershipSplit > 1) {
    throw new Error(
      `ownershipSplit must be in [0,1] (got ${config.ownershipSplit})`,
    );
  }
  if (config.epsilon < 0)
    throw new Error(`epsilon must be >= 0 (got ${config.epsilon})`);

  const internal: InternalRecord[] = records.map((r) => ({
    address: r.funder.toBase58(),
    funder: r.funder,
    committedAtoms: bnToBig(r.committedAmount),
    accumulator: bnToBig(r.committedAmountAccumulator),
    lastUpdate: bnToBig(r.lastAccumulatorUpdate),
    score: r.score,
  }));
  const events: InternalFundEvent[] = fundEvents.map((e) => ({
    funderAddr: e.funderAddr,
    amount: bnToBig(e.amount),
    timestamp: bnToBig(e.timestamp),
  }));

  const target = bnToBig(config.totalAllocation);
  const start = bnToBig(config.launchStartTime);
  const duration = bnToBig(config.secondsForLaunch);
  const activationDelay = bnToBig(config.accumulatorActivationDelaySeconds);
  const poolUsdc = Number(target) / Number(USDC_SCALAR);

  // Accumulator weights = full-pool cranker approvals (ratio used on the acc road).
  const { approved: weightAtoms, cappedCount } = accumulatorApproved(
    internal,
    target,
    start,
    duration,
    activationDelay,
    events,
    config.boost,
  );

  const agents: Agent[] = internal.map((r) => ({
    address: r.address,
    score: Math.round(r.score * 100) / 100,
    committed:
      Math.round((Number(r.committedAtoms) / Number(USDC_SCALAR)) * 100) / 100,
    weight:
      Math.round(
        (Number(weightAtoms.get(r.address) ?? 0n) / Number(USDC_SCALAR)) * 100,
      ) / 100,
  }));

  if (config.reactivity <= 0 || config.reactivity > 1) {
    throw new Error(`reactivity must be in (0,1] (got ${config.reactivity})`);
  }

  const { onOwn, payouts, rounds, atNash, maxGain } = solveNash(
    agents,
    poolUsdc,
    config.ownershipSplit,
    config.epsilon,
    config.reactivity,
    config.startMode,
    config.seed,
  );
  const filled = fillToPool(payouts, agents, poolUsdc);

  const addrs = internal.map((r) => r.address);
  const committedAtoms = new Map(
    internal.map((r) => [r.address, r.committedAtoms]),
  );
  const finalD = new Map(addrs.map((a, i) => [a, filled[i]]));
  const finalAtoms = dollarsToAtomsExact(finalD, committedAtoms, addrs, target);

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

  const lines: AllocationLine[] = internal.map((r, i) => {
    const last = bigToBn(r.lastUpdate);
    const first =
      (eventCountByFunder.get(r.address) ?? 0) > 1
        ? (firstFundByFunder.get(r.address) ?? last)
        : last;
    return {
      funder: r.funder,
      committedAmount: bigToBn(r.committedAtoms),
      approvedAmount: bigToBn(finalAtoms.get(r.address)!),
      kind: onOwn[i] ? "ownership" : "accumulator",
      score: r.score,
      accumulatorWeight: bigToBn(weightAtoms.get(r.address) ?? 0n),
      lastAccumulatorUpdate: last,
      firstFundTime: first,
    };
  });

  const approvals: FundingApproval[] = lines.map((l) => ({
    funder: l.funder,
    approvedAmount: l.approvedAmount,
  }));

  return {
    lines,
    approvals,
    cappedCount,
    ownershipCount: lines.filter((l) => l.kind === "ownership").length,
    rounds,
    atNash,
    maxGain,
  };
}
