/**
 * Shared allocation helpers — USDC formatting, keys, clock, CSV, audit JSON, printers.
 */
import { readFileSync, writeFileSync } from "node:fs";

import {
  type Connection,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import BN from "bn.js";
import bs58 from "bs58";

import type { AllocationResult as NashResult } from "./strategies/nash";
import type { AllocationResult as PreallocResult } from "./strategies/preallocAccum";

export const USDC_DECIMALS = 6;

export const usdc = (whole: number): BN =>
  new BN(whole).mul(new BN(10).pow(new BN(USDC_DECIMALS)));

export function fmtUsdc(atoms: BN): string {
  const divisor = new BN(10).pow(new BN(USDC_DECIMALS));
  const whole = atoms.div(divisor).toString();
  const frac = atoms
    .mod(divisor)
    .toString()
    .padStart(USDC_DECIMALS, "0")
    .slice(0, 2);
  return `$${Number(whole).toLocaleString("en-US")}.${frac}`;
}

export function confirmYes(message: string): boolean {
  const answer = prompt(`${message} [yes/no]`);
  const normalized = answer?.trim().toLowerCase();
  return normalized === "yes" || normalized === "y";
}

export function loadKeypair(raw: string): Keypair {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    const bytes = JSON.parse(trimmed) as number[];
    if (!Array.isArray(bytes) || bytes.length !== 64) {
      throw new Error("Authority key JSON array must contain exactly 64 bytes");
    }
    return Keypair.fromSecretKey(new Uint8Array(bytes));
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

export async function getSysvarClockTime(
  connection: Connection,
): Promise<number> {
  const info = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);
  if (!info || !info.data || info.data.length < 40) {
    throw new Error("Failed to read Clock sysvar");
  }
  return Number(info.data.readBigInt64LE(32));
}

export function loadPreAllocations(filePath: string): Map<string, BN> {
  const rows = readFileSync(filePath, "utf8").trim().split("\n").slice(1);
  const out = new Map<string, BN>();
  for (const row of rows) {
    if (!row.trim()) continue;
    const comma = row.indexOf(",");
    const address = row.slice(0, comma).trim();
    const dollars = parseInt(row.slice(comma + 1).replace(/[^0-9]/g, ""), 10);
    try {
      new PublicKey(address);
    } catch {
      throw new Error(`Invalid base58 address in ${filePath}: ${address}`);
    }
    if (!Number.isFinite(dollars) || dollars <= 0) {
      throw new Error(
        `Invalid allocation amount for ${address} in ${filePath}`,
      );
    }
    if (out.has(address)) {
      throw new Error(`Duplicate address in ${filePath}: ${address}`);
    }
    out.set(
      address,
      new BN(dollars).mul(new BN(10).pow(new BN(USDC_DECIMALS))),
    );
  }
  if (out.size === 0) {
    throw new Error(`No pre-allocations found in ${filePath}`);
  }
  return out;
}

export function writeAllocationJson(
  filePath: string,
  lines: Array<{
    funder: PublicKey;
    kind: string;
    committedAmount: BN;
    approvedAmount: BN;
    score?: number;
    accumulatorWeight?: BN;
  }>,
): void {
  const rows = lines.map((l) => ({
    funder: l.funder.toBase58(),
    kind: l.kind,
    committed: l.committedAmount.toString(),
    approved: l.approvedAmount.toString(),
    ...(l.score !== undefined ? { score: l.score } : {}),
    ...(l.accumulatorWeight !== undefined
      ? { accumulatorWeight: l.accumulatorWeight.toString() }
      : {}),
  }));
  writeFileSync(filePath, JSON.stringify(rows, null, 2));
}

export function printNashTable(
  result: NashResult,
  totalAllocation: BN,
  launchStartTime: BN,
): void {
  const sorted = [...result.lines].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "ownership" ? -1 : 1;
    return a.lastAccumulatorUpdate.cmp(b.lastAccumulatorUpdate);
  });

  const hrsOf = (t: BN): string =>
    (t.sub(launchStartTime).toNumber() / 3600).toFixed(1);

  console.log(
    "\n  road         funder                                        score      committed          approved   % commit   hrs+start (first→last)",
  );
  console.log("  ".padEnd(140, "─"));
  let approvedTotal = new BN(0);
  let committedTotal = new BN(0);
  for (const l of sorted) {
    approvedTotal = approvedTotal.add(l.approvedAmount);
    committedTotal = committedTotal.add(l.committedAmount);
    const pct = l.committedAmount.isZero()
      ? "—"
      : `${((l.approvedAmount.toNumber() / l.committedAmount.toNumber()) * 100).toFixed(1)}%`;
    const hrs = l.lastAccumulatorUpdate.isZero()
      ? "—"
      : l.firstFundTime.eq(l.lastAccumulatorUpdate)
        ? hrsOf(l.lastAccumulatorUpdate)
        : `${hrsOf(l.firstFundTime)}→${hrsOf(l.lastAccumulatorUpdate)}`;
    const scoreStr =
      l.score > 0 ? Math.round(l.score).toLocaleString("en-US") : "—";
    console.log(
      `  ${l.kind.padEnd(12)} ${l.funder.toBase58().padEnd(44)} ${scoreStr.padStart(10)} ${fmtUsdc(l.committedAmount).padStart(15)} ${fmtUsdc(l.approvedAmount).padStart(15)} ${pct.padStart(8)}   ${hrs.padEnd(14)}`,
    );
  }
  console.log("  ".padEnd(140, "─"));
  console.log(
    `  Funders: ${result.lines.length} (${result.ownershipCount} ownership road, ${result.lines.length - result.ownershipCount} accumulator) | ` +
      `Committed: ${fmtUsdc(committedTotal)} | Weight-capped: ${result.cappedCount}`,
  );
  console.log(
    `  Nash: ${result.atNash ? "✓ ε-equilibrium" : "✗ not settled"} after ${result.rounds} BR rounds` +
      ` (max switch gain $${result.maxGain.toFixed(2)})`,
  );
  console.log(
    `  Σ approved: ${fmtUsdc(approvedTotal)}  (target ${fmtUsdc(totalAllocation)})  ${approvedTotal.eq(totalAllocation) ? "✓ matches" : "✗ MISMATCH"}\n`,
  );

  if (!approvedTotal.eq(totalAllocation)) {
    throw new Error(
      `Allocation invariant failed: Σ approved (${approvedTotal.toString()}) !== TOTAL_ALLOCATION (${totalAllocation.toString()})`,
    );
  }
}

export function printPreallocTable(
  result: PreallocResult,
  totalAllocation: BN,
  launchStartTime: BN,
): void {
  const sorted = [...result.lines].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "pre" ? -1 : 1;
    return a.lastAccumulatorUpdate.cmp(b.lastAccumulatorUpdate);
  });

  const hrsOf = (t: BN): string =>
    (t.sub(launchStartTime).toNumber() / 3600).toFixed(1);

  console.log(
    "\n  kind   funder                                        committed          approved   % commit   hrs+start (first→last)",
  );
  console.log("  ".padEnd(132, "─"));
  let approvedTotal = new BN(0);
  let committedTotal = new BN(0);
  for (const l of sorted) {
    approvedTotal = approvedTotal.add(l.approvedAmount);
    committedTotal = committedTotal.add(l.committedAmount);
    const pct = l.committedAmount.isZero()
      ? "—"
      : `${((l.approvedAmount.toNumber() / l.committedAmount.toNumber()) * 100).toFixed(1)}%`;
    const hrs = l.lastAccumulatorUpdate.isZero()
      ? "—"
      : l.firstFundTime.eq(l.lastAccumulatorUpdate)
        ? hrsOf(l.lastAccumulatorUpdate)
        : `${hrsOf(l.firstFundTime)}→${hrsOf(l.lastAccumulatorUpdate)}`;
    console.log(
      `  ${l.kind.padEnd(6)} ${l.funder.toBase58().padEnd(44)} ${fmtUsdc(l.committedAmount).padStart(15)} ${fmtUsdc(l.approvedAmount).padStart(15)} ${pct.padStart(8)}   ${hrs.padEnd(14)}`,
    );
  }
  console.log("  ".padEnd(132, "─"));
  console.log(
    `  Funders: ${result.lines.length} (${result.lines.filter((l) => l.kind === "pre").length} pre-allocated) | ` +
      `Committed: ${fmtUsdc(committedTotal)} | Pre-allocated off-top: ${fmtUsdc(result.preAllocatedTotal)} | ` +
      `Accumulator remainder: ${fmtUsdc(result.remaining)}`,
  );
  console.log(
    `  Σ approved: ${fmtUsdc(approvedTotal)}  (target ${fmtUsdc(totalAllocation)})  ${approvedTotal.eq(totalAllocation) ? "✓ matches" : "✗ MISMATCH"}\n`,
  );

  if (!approvedTotal.eq(totalAllocation)) {
    throw new Error(
      `Allocation invariant failed: Σ approved (${approvedTotal.toString()}) !== TOTAL_ALLOCATION (${totalAllocation.toString()})`,
    );
  }
}
