/**
 * Helpers for ripcars.ts — USDC formatting, key/clock loading, table printer,
 * confirmation prompt, and allocation.out.json writer (same shape as credible/laso).
 */
import { writeFileSync } from "node:fs";

import { type Connection, Keypair, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import BN from "bn.js";
import bs58 from "bs58";

import type { AllocationResult } from "./allocation";

export const USDC_DECIMALS = 6;

/** Whole USDC → atoms. */
export const usdc = (whole: number): BN =>
  new BN(whole).mul(new BN(10).pow(new BN(USDC_DECIMALS)));

/** Format USDC atoms as a human dollar string. */
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

/** An allocation row in the audit JSON (compatible with credible/laso shape). */
export interface AllocationRow {
  funder: string;
  kind: "ownership" | "accumulator";
  committed: string;
  approved: string;
  score?: number;
  accumulatorWeight?: string;
}

/** Write the allocation to a JSON audit file — exact per-funder amounts. */
export function writeAllocationJson(
  filePath: string,
  result: AllocationResult,
): void {
  const rows: AllocationRow[] = result.lines.map((l) => ({
    funder: l.funder.toBase58(),
    kind: l.kind,
    committed: l.committedAmount.toString(),
    approved: l.approvedAmount.toString(),
    score: l.score,
    accumulatorWeight: l.accumulatorWeight.toString(),
  }));
  writeFileSync(filePath, JSON.stringify(rows, null, 2));
}

/** Blocking terminal confirmation. Returns true only on an explicit yes/y. */
export function confirmYes(message: string): boolean {
  const answer = prompt(`${message} [yes/no]`);
  const normalized = answer?.trim().toLowerCase();
  return normalized === "yes" || normalized === "y";
}

/**
 * Parse a private key. Supports a JSON byte array ([1,2,...], 64 bytes) or a
 * base58 string.
 */
export function loadKeypair(raw: string): Keypair {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    const bytes = JSON.parse(trimmed) as number[];
    if (!Array.isArray(bytes) || bytes.length !== 64) {
      throw new Error(
        "RIPCARS_AUTHORITY_KEY JSON array must contain exactly 64 bytes",
      );
    }
    return Keypair.fromSecretKey(new Uint8Array(bytes));
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

/** Read on-chain unix time from the Clock sysvar. */
export async function getSysvarClockTime(
  connection: Connection,
): Promise<number> {
  const info = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);
  if (!info || !info.data || info.data.length < 40) {
    throw new Error("Failed to read Clock sysvar");
  }
  return Number(info.data.readBigInt64LE(32));
}

/**
 * Print the allocation as a readable CLI table, then assert Σ approved == target.
 * Ownership-road funders first, then accumulator — each group time-sorted earliest fund first.
 */
export function printAllocationTable(
  result: AllocationResult,
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
