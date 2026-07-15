/**
 * Unit tests for computeAllocation — the off-the-top composition (the only
 * bespoke allocation logic; the accumulator itself is byte-identical to the
 * accelerated-cranker and trusted). Pre-allocated wallets get a FIXED amount
 * (capped at committed); the remainder goes to the accumulator pool.
 *
 * Run: bun test
 */
import { test, expect } from "bun:test";
import { Keypair, type PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { computeAllocation } from "../allocation";
import type { AccumulatorFundingRecord, BoostConfig } from "../ac/accumulator";

// Timing: start=1000, duration=1000 → close=2000; activation delay 0 → activation=1000.
const START = new BN(1000);
const DURATION = new BN(1000);
const ACTIVATION_DELAY = new BN(0);

// multiplier 1 disables the boost, so the accumulator is plain time-weighted.
const NO_BOOST: BoostConfig = {
  multiplier: 1,
  fillCeiling: 3,
  lookAheadSeconds: 0,
};

/** A funded record. `lastUpdate` = 1000 (= activation) so it earns the full window. */
function rec(funder: PublicKey, committed: number): AccumulatorFundingRecord {
  return {
    funder,
    committedAmount: new BN(committed),
    committedAmountAccumulator: new BN(0),
    lastAccumulatorUpdate: new BN(1000),
  };
}

const sumApproved = (lines: { approvedAmount: BN }[]): BN =>
  lines.reduce((s, l) => s.add(l.approvedAmount), new BN(0));

const allocate = (
  records: AccumulatorFundingRecord[],
  preAllocated: Map<string, BN>,
  total: number,
) =>
  computeAllocation(
    records,
    preAllocated,
    new BN(total),
    START,
    DURATION,
    ACTIVATION_DELAY,
    NO_BOOST,
    [],
  );

test("pre-allocated wallets get their FIXED amount; a regular funder absorbs the remainder", () => {
  const pre = Keypair.generate().publicKey;
  const reg = Keypair.generate().publicKey;
  const records = [rec(pre, 500), rec(reg, 1000)];

  const result = allocate(
    records,
    new Map([[pre.toBase58(), new BN(100)]]),
    300,
  );

  expect(result.preAllocatedTotal.toString()).toBe("100");
  expect(result.remaining.toString()).toBe("200");
  const preLine = result.lines.find((l) => l.funder.equals(pre))!;
  expect(preLine.kind).toBe("pre");
  expect(preLine.approvedAmount.toString()).toBe("100"); // fixed amount, NOT committed (500)
  const regLine = result.lines.find((l) => l.funder.equals(reg))!;
  expect(regLine.kind).toBe("accum");
  expect(regLine.approvedAmount.toString()).toBe("200"); // the remainder
  expect(sumApproved(result.lines).toString()).toBe("300");
});

test("remaining == 0: pre-alloc consume the whole total, every regular funder gets 0", () => {
  const pre = Keypair.generate().publicKey;
  const reg1 = Keypair.generate().publicKey;
  const reg2 = Keypair.generate().publicKey;
  const records = [rec(pre, 500), rec(reg1, 1000), rec(reg2, 500)];

  const result = allocate(
    records,
    new Map([[pre.toBase58(), new BN(300)]]),
    300,
  );

  expect(result.remaining.toString()).toBe("0");
  expect(
    result.lines.find((l) => l.funder.equals(reg1))!.approvedAmount.toString(),
  ).toBe("0");
  expect(
    result.lines.find((l) => l.funder.equals(reg2))!.approvedAmount.toString(),
  ).toBe("0");
  expect(sumApproved(result.lines).toString()).toBe("300");
});

test("pre-allocated total exceeds the total → throws", () => {
  const pre = Keypair.generate().publicKey;
  const reg = Keypair.generate().publicKey;
  const records = [rec(pre, 500), rec(reg, 1000)];
  expect(() =>
    allocate(records, new Map([[pre.toBase58(), new BN(400)]]), 300),
  ).toThrow(/> totalAllocation/);
});

test("a pre-allocated amount above that wallet's committed → throws", () => {
  const pre = Keypair.generate().publicKey;
  const reg = Keypair.generate().publicKey;
  const records = [rec(pre, 100), rec(reg, 1000)];
  expect(() =>
    allocate(records, new Map([[pre.toBase58(), new BN(200)]]), 500),
  ).toThrow(/exceeds its committed/);
});

test("a pre-allocated wallet that never funded → throws", () => {
  const phantom = Keypair.generate().publicKey;
  const reg = Keypair.generate().publicKey;
  const records = [rec(reg, 1000)];
  expect(() =>
    allocate(records, new Map([[phantom.toBase58(), new BN(100)]]), 300),
  ).toThrow(/no funding record/);
});

test("invariants on a mixed set: Σ == total, every approved ≤ committed, none negative, pre exact", () => {
  const pre = Keypair.generate().publicKey;
  const regs = [
    Keypair.generate().publicKey,
    Keypair.generate().publicKey,
    Keypair.generate().publicKey,
  ];
  const records = [
    rec(pre, 500),
    rec(regs[0]!, 1000),
    rec(regs[1]!, 1000),
    rec(regs[2]!, 1000),
  ];

  const result = allocate(
    records,
    new Map([[pre.toBase58(), new BN(300)]]),
    800,
  );

  expect(sumApproved(result.lines).toString()).toBe("800");
  const committedByFunder = new Map(
    records.map((r) => [r.funder.toBase58(), r.committedAmount]),
  );
  for (const l of result.lines) {
    expect(l.approvedAmount.isNeg()).toBe(false);
    expect(
      l.approvedAmount.lte(committedByFunder.get(l.funder.toBase58())!),
    ).toBe(true);
  }
  expect(
    result.lines.find((l) => l.funder.equals(pre))!.approvedAmount.toString(),
  ).toBe("300"); // exact fixed amount
});
