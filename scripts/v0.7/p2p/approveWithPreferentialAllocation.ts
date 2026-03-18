/// Preferential allocation script for P2P launches.
///
/// Implements the tiered XP multiplier formula from p2p-points.md:
///   1. Compute base pro-rata rate: r = F / C
///   2. Each participant gets base_i = c_i * r
///   3. XP holders get pref_i = min(base_i * multiplier, c_i)
///   4. Non-XP holders split the remaining pool pro-rata by commitment
///
/// Run: anchor run p2p-approve

import {
  ComputeBudgetProgram,
  Keypair,
  Transaction,
  PublicKey,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/futarchy/v0.7";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import BN from "bn.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type XpTier = 1 | 2 | 3;

/** Unified representation used for allocation math. Uses string keys — no PublicKey needed. */
type FunderRecord = {
  id: string;
  committedAmount: BN;
  tier: XpTier | null;
};

/** FunderRecord with computed allocation. */
type AllocatedRecord = FunderRecord & {
  allocation: BN;
  refund: BN;
};

// ---------------------------------------------------------------------------
// Config — edit these per launch
// ---------------------------------------------------------------------------

const TIER_MULTIPLIERS: Record<XpTier, number> = {
  1: 3,
  2: 2,
  3: 1.5,
};

// Multiplier precision: we work in integer math by scaling multipliers by 1000.
// 3x = 3000, 2x = 2000, 1.5x = 1500.
const MULTIPLIER_SCALE = 1000;
const SCALED_MULTIPLIERS: Record<XpTier, number> = {
  1: TIER_MULTIPLIERS[1] * MULTIPLIER_SCALE,
  2: TIER_MULTIPLIERS[2] * MULTIPLIER_SCALE,
  3: TIER_MULTIPLIERS[3] * MULTIPLIER_SCALE,
};

/** The launch account address. Required for on-chain mode. */
const LAUNCH_ADDR = PublicKey.default;

/** The funding cap (F) that founders accept, in USDC atoms. */
const FINAL_RAISE_AMOUNT = new BN(10_000_000000); // e.g. $10,000 as in the worked example

/** How many approval ixs per transaction. */
const BATCH_SIZE = 20;

// ---------------------------------------------------------------------------
// Anchor setup
// ---------------------------------------------------------------------------

dotenv.config();

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];
const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

const scriptsDir = path.join(process.cwd(), "scripts/v0.7/p2p");

// ---------------------------------------------------------------------------
// Data ingestion — comment out one or the other in main()
// ---------------------------------------------------------------------------

/** Load funding data directly from funders.csv. */
function loadFromCsv(): FunderRecord[] {
  const csv = fs.readFileSync(path.join(scriptsDir, "funders.csv"), "utf-8");
  const lines = csv.trim().split("\n");
  // Skip header: funder,committed,tier
  return lines.slice(1).map((line) => {
    const [funder, committedStr, tierStr] = line.split(",");
    const tier = tierStr?.trim();
    return {
      id: funder.trim(),
      committedAmount: new BN(committedStr.trim()),
      tier: tier === "1" ? 1 : tier === "2" ? 2 : tier === "3" ? 3 : null, // 0 or empty = no tier
    };
  });
}

/** Load funding records from on-chain, attach tier info from funders.csv. */
async function loadFromChain(): Promise<FunderRecord[]> {
  // Tier data comes from CSV — only committed amounts come from chain
  const tierMap: Record<string, XpTier | null> = {};
  for (const r of loadFromCsv()) {
    tierMap[r.id] = r.tier;
  }

  const allFundingRecords =
    await launchpad.launchpad.account.fundingRecord.all();
  const launchRecords = allFundingRecords.filter(
    (r) => r.account.launch.toString() === LAUNCH_ADDR.toString(),
  );

  console.log(
    `Found ${launchRecords.length} on-chain funding records for launch ${LAUNCH_ADDR.toBase58()}`,
  );

  return launchRecords.map((r) => ({
    id: r.account.funder.toString(),
    committedAmount: r.account.committedAmount,
    tier: tierMap[r.account.funder.toString()] ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Allocation math (p2p-points.md formula)
// ---------------------------------------------------------------------------

function computeAllocations(records: FunderRecord[], F: BN): AllocatedRecord[] {
  // C = total committed by all participants
  const C = records.reduce((acc, r) => acc.add(r.committedAmount), new BN(0));

  if (C.isZero()) {
    console.error("Total committed is zero — nothing to allocate.");
    process.exit(1);
  }

  console.log(`\nTotal committed (C): ${C.toString()}`);
  console.log(`Funding cap     (F): ${F.toString()}`);

  // If total committed <= funding cap, everyone gets their full commitment.
  if (C.lte(F)) {
    console.log(
      "\nTotal committed <= funding cap. Everyone gets full allocation.",
    );
    return records.map((r) => ({
      ...r,
      allocation: r.committedAmount,
      refund: new BN(0),
    }));
  }

  const xpRecords = records.filter((r) => r.tier !== null);
  const nonXpRecords = records.filter((r) => r.tier === null);

  // --- Steps 1-3: XP holder allocations ---
  // base_i = c_i * F / C   (pro-rata)
  // pref_i = min(base_i * m_t, c_i)
  //
  // Integer math: pref_i = min(c_i * F * m_t_scaled / (C * SCALE), c_i)
  const xpAllocations: { record: FunderRecord; allocation: BN }[] =
    xpRecords.map((r) => {
      const scaledMultiplier = new BN(SCALED_MULTIPLIERS[r.tier!]);
      const pref = r.committedAmount
        .mul(F)
        .mul(scaledMultiplier)
        .div(C.mul(new BN(MULTIPLIER_SCALE)));
      const capped = BN.min(pref, r.committedAmount);
      return { record: r, allocation: capped };
    });

  // --- Step 4: Total preferred ---
  const A_pref = xpAllocations.reduce(
    (acc, x) => acc.add(x.allocation),
    new BN(0),
  );

  console.log(`\nXP holders: ${xpRecords.length}`);
  console.log(`Non-XP holders: ${nonXpRecords.length}`);
  console.log(`Total XP allocation (A_pref): ${A_pref.toString()}`);

  // --- Step 5: Remaining pool ---
  const A_remaining = F.sub(A_pref);
  console.log(`Remaining for non-XP (A_remaining): ${A_remaining.toString()}`);

  if (A_remaining.isNeg()) {
    console.error(
      "\nWARNING: XP allocations exceed funding cap! Multipliers are too " +
        "high relative to oversubscription ratio.",
    );
  }

  // --- Step 6: Non-XP allocation ---
  const C_N = nonXpRecords.reduce(
    (acc, r) => acc.add(r.committedAmount),
    new BN(0),
  );

  const nonXpAllocations: { record: FunderRecord; allocation: BN }[] =
    nonXpRecords.map((r) => {
      if (C_N.isZero() || A_remaining.lte(new BN(0))) {
        return { record: r, allocation: new BN(0) };
      }
      const alloc = r.committedAmount.mul(A_remaining).div(C_N);
      return { record: r, allocation: alloc };
    });

  // --- Combine and compute refunds ---
  const allAllocations = [...xpAllocations, ...nonXpAllocations];

  return allAllocations.map(({ record, allocation }) => ({
    ...record,
    allocation,
    refund: record.committedAmount.sub(allocation),
  }));
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function printResults(results: AllocatedRecord[], F: BN) {
  const tierLabel = (t: XpTier | null) =>
    t === null ? "1x" : `${TIER_MULTIPLIERS[t]}x`;

  const toUsd = (atoms: BN) =>
    `$${(atoms.toNumber() / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  console.log("\n" + "=".repeat(116));
  console.log("ALLOCATION RESULTS");
  console.log("=".repeat(116));
  console.log(
    [
      "Funder".padEnd(46),
      "Committed".padStart(16),
      "Approved".padStart(16),
      "Refund".padStart(16),
      "Tier".padStart(6),
      "Approved (USD)".padStart(16),
    ].join(""),
  );
  console.log("-".repeat(116));

  for (const r of results) {
    console.log(
      [
        r.id.padEnd(46),
        r.committedAmount.toString().padStart(16),
        r.allocation.toString().padStart(16),
        r.refund.toString().padStart(16),
        tierLabel(r.tier).padStart(6),
        toUsd(r.allocation).padStart(16),
      ].join(""),
    );
  }

  const totalAllocation = results.reduce(
    (acc, r) => acc.add(r.allocation),
    new BN(0),
  );
  const totalRefund = results.reduce((acc, r) => acc.add(r.refund), new BN(0));
  const totalCommitted = results.reduce(
    (acc, r) => acc.add(r.committedAmount),
    new BN(0),
  );

  console.log("-".repeat(116));
  console.log(
    [
      "TOTAL".padEnd(46),
      totalCommitted.toString().padStart(16),
      totalAllocation.toString().padStart(16),
      totalRefund.toString().padStart(16),
      "".padStart(6),
      toUsd(totalAllocation).padStart(16),
    ].join(""),
  );

  const dust = F.sub(totalAllocation);
  if (!dust.isZero()) {
    console.log(
      `\nRounding dust: ${dust.toString()} atoms (${dust.isNeg() ? "over" : "under"}-allocated)`,
    );
  }
}

// ---------------------------------------------------------------------------
// On-chain approval (kept behind a return statement for safety)
// ---------------------------------------------------------------------------

async function sendApprovals(results: AllocatedRecord[]) {
  const approveIxs = await Promise.all(
    results.map((r) =>
      launchpad
        .setFundingRecordApprovalIx({
          launch: LAUNCH_ADDR,
          funder: new PublicKey(r.id),
          approvedAmount: r.allocation,
        })
        .instruction(),
    ),
  );

  for (let i = 0; i < approveIxs.length; i += BATCH_SIZE) {
    const batch = approveIxs.slice(i, i + BATCH_SIZE);

    const tx = new Transaction();
    tx.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: BATCH_SIZE * 16_000,
      }),
    );

    for (const ix of batch) {
      tx.add(ix);
    }

    await sendAndConfirmTransaction(tx, `Approve batch ${i / BATCH_SIZE + 1}`);
  }

  console.log("\nAll approvals processed successfully!");
}

async function sendAndConfirmTransaction(
  tx: Transaction,
  label: string,
  signers: Keypair[] = [],
) {
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.partialSign(payer, ...signers);
  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  console.log(`${label} transaction sent:`, txHash);

  await provider.connection.confirmTransaction(txHash, "confirmed");
  const txStatus = await provider.connection.getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (txStatus?.meta?.err) {
    throw new Error(
      `Transaction failed: ${txHash}\nError: ${JSON.stringify(
        txStatus?.meta?.err,
      )}\n\n${txStatus?.meta?.logMessages?.join("\n")}`,
    );
  }
  console.log(`${label} transaction confirmed`);
  return txHash;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Toggle ingestion source by commenting out one of these:
  const records = loadFromCsv();
  // const records = await loadFromChain();

  console.log(`Loaded ${records.length} funding records`);

  if (records.length === 0) {
    console.log("No records to process.");
    return;
  }

  const results = computeAllocations(records, FINAL_RAISE_AMOUNT);

  // Distribute rounding dust: add 1 atom to records that still have headroom
  // (allocation < committed) until we close the gap to F.
  const totalAllocated = results.reduce(
    (acc, r) => acc.add(r.allocation),
    new BN(0),
  );
  let dust = FINAL_RAISE_AMOUNT.sub(totalAllocated);

  for (const r of results) {
    if (dust.lte(new BN(0))) break;
    if (r.allocation.lt(r.committedAmount)) {
      r.allocation = r.allocation.add(new BN(1));
      r.refund = r.refund.sub(new BN(1));
      dust = dust.sub(new BN(1));
    }
  }

  printResults(results, FINAL_RAISE_AMOUNT);

  // Remove this return to send on-chain approvals
  return;

  await sendApprovals(results);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
