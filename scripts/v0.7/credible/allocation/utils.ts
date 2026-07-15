/**
 * Small helpers for credible.ts — USDC formatting, key/clock/wallet-file loading,
 * and the allocation table printer. Pulled out to keep credible.ts focused on the
 * allocation logic and crank flow.
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

import type { AllocationResult } from "./allocation";

/** USDC has 6 decimals; committed/approved amounts are in atoms. */
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

/** An allocation row in the audit JSON (all amounts as atom strings). */
export interface AllocationRow {
  funder: string;
  kind: "pre" | "accum";
  committed: string;
  approved: string;
}

/** Write the allocation to a JSON audit file — a record of exactly what was allocated. */
export function writeAllocationJson(
  filePath: string,
  result: AllocationResult,
): void {
  const rows: AllocationRow[] = result.lines.map((l) => ({
    funder: l.funder.toBase58(),
    kind: l.kind,
    committed: l.committedAmount.toString(),
    approved: l.approvedAmount.toString(),
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
 * base58 string. Mirrors the accelerated-cranker loader.
 */
export function loadKeypair(raw: string): Keypair {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    const bytes = JSON.parse(trimmed) as number[];
    if (!Array.isArray(bytes) || bytes.length !== 64) {
      throw new Error(
        "CREDIBLE_AUTHORITY_KEY JSON array must contain exactly 64 bytes",
      );
    }
    return Keypair.fromSecretKey(new Uint8Array(bytes));
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

/**
 * Read the on-chain unix time from the Clock sysvar — the SAME source the
 * program uses to enforce launch expiry (and what surfpool's timeTravel moves).
 * Copied from ChainLaunchWatcher.getSysvarClockTime.
 */
export async function getSysvarClockTime(
  connection: Connection,
): Promise<number> {
  const info = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);
  if (!info || !info.data || info.data.length < 40) {
    throw new Error("Failed to read Clock sysvar");
  }
  // Clock sysvar: unix_timestamp is i64 at offset 32.
  return Number(info.data.readBigInt64LE(32));
}

/**
 * Load pre-allocations from a CSV with a header row and columns `Address,Allocated`
 * (e.g. `GaDZ…,"$375,000 "`). Returns a map of base58 wallet → allocation in USDC
 * atoms. Each wallet gets this fixed amount off the top (capped at its committed).
 * Throws on a malformed address or a non-positive amount.
 */
export function loadPreAllocations(filePath: string): Map<string, BN> {
  const rows = readFileSync(filePath, "utf8").trim().split("\n").slice(1); // skip header
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
    if (out.has(address))
      throw new Error(`Duplicate address in ${filePath}: ${address}`);
    out.set(
      address,
      new BN(dollars).mul(new BN(10).pow(new BN(USDC_DECIMALS))),
    );
  }
  if (out.size === 0)
    throw new Error(`No pre-allocations found in ${filePath}`);
  return out;
}

/**
 * Print the allocation as a readable table, then assert Σ approved == target.
 * Throws on mismatch so a dry-run surfaces a broken allocation before any send.
 *
 * Sorted by fund time (earliest first) so the time-weighting is visible going
 * down the list. `hrs` = hours from launch start to the funder's LAST fund()
 * call (the only fund timestamp the on-chain record stores).
 */
export function printAllocationTable(
  result: AllocationResult,
  totalAllocation: BN,
  launchStartTime: BN,
): void {
  // Pre-allocated ("pre") always on top; the rest time-sorted (earliest fund first).
  const sorted = [...result.lines].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "pre" ? -1 : 1;
    return a.lastAccumulatorUpdate.cmp(b.lastAccumulatorUpdate);
  });

  // Hours from launch start to a fund timestamp.
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
    // Show first→last only for funders who topped up (first != last); otherwise the single hour.
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
