/**
 * credible — allocate a launch with a set of full-allocation wallets off the top,
 * then the accumulator algorithm for everyone else.
 *
 * Flow:
 *   1. Fetch the launch.
 *   2. --execute: if the launch is still live + expired, confirm and closeLaunch
 *      FIRST — this freezes the funder set so a late fund can't invalidate the
 *      allocation. (Dry-run never closes.)
 *   3. Fetch funding records (now frozen) + fund events.
 *   4. Allocate: pre-allocated wallets get approved = committed; the remainder
 *      (TOTAL_ALLOCATION − Σ pre-allocated) is split among everyone else by the
 *      accelerated-cranker accumulator. Print the table.
 *   5. Dry-run stops here. --execute confirms + sends the approvals, then verifies
 *      total_approved == TOTAL_ALLOCATION on-chain. Each on-chain step is confirmed
 *      at the terminal.
 *
 * credible sets the allocation and stops — it does NOT completeLaunch. The launch is
 * left in "Closed" state; completeLaunch and the performance package are done
 * manually afterward (by whoever holds the launch authority).
 *
 * Run:
 *   bun install
 *   bun credible.ts               # dry run (default)
 *   bun credible.ts --execute     # set the allocation (requires CREDIBLE_AUTHORITY_KEY in .env)
 */
import * as anchor from "@coral-xyz/anchor";
import {
  getLaunchAddr,
  LaunchpadClient,
} from "@metadaoproject/programs/launchpad/v0.7";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import BN from "bn.js";
import { config as loadDotenv } from "dotenv";

import {
  type AccumulatorFundingRecord,
  type BoostConfig,
} from "./ac/accumulator.js";
import {
  approveFundingRecords,
  fetchLaunchAtSlot,
} from "./ac/fundingApproval.js";
import {
  CLOCK_DRIFT_BUFFER_SECONDS,
  PRIORITY_FEE_MICRO_LAMPORTS,
} from "./ac/constants.js";
import { computeAllocation } from "./allocation.js";
import { fetchFundEvents } from "./db.js";
import { log } from "./logger.js";
import {
  confirmYes,
  fmtUsdc,
  getSysvarClockTime,
  loadPreAllocations,
  loadKeypair,
  printAllocationTable,
  usdc,
  writeAllocationJson,
} from "./utils.js";

import {
  TOTAL_ALLOCATION as TOTAL_ALLOCATION_CONSTANT,
  TOKEN_SEED,
} from "../constants.js";

import * as token from "@solana/spl-token";

/** Audit file: the exact per-funder allocation this run computed. */
const ALLOCATION_OUT_FILE = `${import.meta.dir}/allocation.out.json`;

// Load the .env sitting beside this script (not the repo-root prod .env).
// override: the file is the source of truth — beat any stale inherited env
// (e.g. when spawned by test.ts after it rewrote .env).
loadDotenv({ path: `${import.meta.dir}/.env`, override: true });

const _provider = anchor.AnchorProvider.env();

const _payer = (
  _provider.wallet as anchor.Wallet & { payer: anchor.web3.Keypair }
).payer;
/*************************************************
 * ***********************************************
 * If you see the stars, it means...
 ***********************************************/
/** The launch to allocate (base58). Live (expired), Closed, or Complete. */
/****************************************************** */
const TOKEN = await PublicKey.createWithSeed(
  _payer.publicKey,
  TOKEN_SEED,
  token.TOKEN_PROGRAM_ID,
);
console.log("Token address:", TOKEN.toBase58());

const [launch] = getLaunchAddr(undefined, TOKEN);
const LAUNCH_ADDRESS = launch.toBase58(); // credible Finance ***** TRIPLE CHECK *****
const TOTAL_ALLOCATION = usdc(TOTAL_ALLOCATION_CONSTANT); //************** KOLLAN CHANGE ME ***********/

// ── Accumulator boost same as accelerated-cranker
const BOOST_MULTIPLIER = 10;
const BOOST_FILL_CEILING = 3;
const BOOST_LOOK_AHEAD_HOURS = 1;

/** Pre-allocation CSV (columns: Address, Allocated), beside this script. */
const PRE_ALLOCATED_CSV = `${import.meta.dir}/ico-pref.csv`;

// ─────────────────────────────────────────────────────────────────────────────

const logger = log.child({ module: "credible" });

/** Boost config, matching the cranker's prod defaults. */
const boostConfig: BoostConfig = {
  multiplier: BOOST_MULTIPLIER,
  fillCeiling: BOOST_FILL_CEILING,
  lookAheadSeconds: BOOST_LOOK_AHEAD_HOURS * 3600,
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Decoded launch account — extended with the v0.7 accumulator field Anchor can't infer. */
type LaunchAccount = Awaited<
  ReturnType<LaunchpadClient["launchpad"]["account"]["launch"]["fetch"]>
> & {
  accumulatorActivationDelaySeconds: number;
};

/** A funding record fetched via `.all()` — extended with accumulator fields. */
type OnChainFundingRecord = Awaited<
  ReturnType<LaunchpadClient["launchpad"]["account"]["fundingRecord"]["all"]>
>[number] & {
  account: {
    committedAmountAccumulator: BN;
    lastAccumulatorUpdate: BN;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Read a required env var or throw a clear error. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required (.env)`);
  return value;
}

/** Launch authority when executing; an ephemeral read-only wallet for dry-run. */
function loadPayer(): anchor.Wallet {
  if (!EXECUTE) return new anchor.Wallet(Keypair.generate()); // never signs anything in dry-run
  return new anchor.Wallet(loadKeypair(requireEnv("CREDIBLE_AUTHORITY_KEY")));
}

/** The launch's on-chain state as a string ("initialized" | "live" | "closed" | "complete" | "refunding"). */
function launchState(account: LaunchAccount): string {
  return Object.keys(account.state as Record<string, unknown>)[0] ?? "unknown";
}

/** Fetch (and re-decode) the launch account. */
async function fetchLaunch(): Promise<LaunchAccount> {
  return (await launchpad.launchpad.account.launch.fetch(
    launchAddr,
  )) as LaunchAccount;
}

/**
 * Close a live, expired launch. Permissionless on-chain; the program enforces
 * the time check. Yields Closed (min raise met) or Refunding (min not met).
 * Throws if the launch hasn't expired yet.
 */
async function closeExpiredLaunch(account: LaunchAccount): Promise<void> {
  const now = await getSysvarClockTime(connection);
  const closeTime =
    account.unixTimestampStarted!.toNumber() + account.secondsForLaunch;
  if (now < closeTime + CLOCK_DRIFT_BUFFER_SECONDS) {
    throw new Error(
      `Launch not yet expired (clock ${now} < close ${closeTime}) — timetravel surfpool past close first`,
    );
  }
  const tx = await launchpad
    .closeLaunchIx({ launch: launchAddr })
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: PRIORITY_FEE_MICRO_LAMPORTS,
      }),
    ])
    .rpc();
  logger.info({ tx }, "Closed launch");
}

/** Log a clean abort (user declined a confirmation) and stop. */
function abort(): void {
  logger.info({}, "Aborted — no further transactions sent.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime setup (module-level). All config is validated here, before any
// on-chain action, so a missing env var / bad wallet file fails immediately.
// ─────────────────────────────────────────────────────────────────────────────

const EXECUTE = process.argv.includes("--execute");

if (TOTAL_ALLOCATION.isZero())
  throw new Error("Set TOTAL_ALLOCATION at the top of this file");

const RPC_URL = requireEnv("RPC_URL");
const PG_URL = requireEnv("FUTARCHY_PG_URL");
const launchAddr = new PublicKey(LAUNCH_ADDRESS);
const payer = loadPayer();
const connection = new Connection(RPC_URL, "confirmed");
const provider = new anchor.AnchorProvider(connection, payer, {
  commitment: "confirmed",
});
const launchpad = LaunchpadClient.createClient({ provider });

// Loaded up front so a malformed CSV fails before any on-chain action.
const preAllocated = loadPreAllocations(PRE_ALLOCATED_CSV);

async function main(): Promise<void> {
  logger.info(
    {
      mode: EXECUTE ? "EXECUTE" : "DRY-RUN",
      wallet: payer.publicKey.toBase58(),
      rpc: RPC_URL,
      launch: LAUNCH_ADDRESS,
    },
    "credible starting",
  );

  // ── Fetch launch ──
  let account = await fetchLaunch();
  if (!account.unixTimestampStarted)
    throw new Error("Launch has no start timestamp");
  logger.info(
    {
      state: launchState(account),
      minimumRaiseAmount: account.minimumRaiseAmount.toString(),
      totalApprovedAmount: account.totalApprovedAmount.toString(),
      totalAllocation: TOTAL_ALLOCATION.toString(),
    },
    "Launch fetched",
  );

  // ── Fund events for the boost. Fetched BEFORE any on-chain write so a DB
  //     failure aborts before we ever close the launch. ──
  const fundEvents = await fetchFundEvents(PG_URL, LAUNCH_ADDRESS);

  // ── Close FIRST (execute only) so the funder set is frozen before we allocate ──
  // Allocating over a still-open launch is wrong: a late fund would invalidate it.
  if (EXECUTE && launchState(account) === "live") {
    if (
      !confirmYes(
        "Launch is not closed. Close it now? (freezes the funder set)",
      )
    )
      return abort();
    await closeExpiredLaunch(account);
    account = await fetchLaunch();
    logger.info({ state: launchState(account) }, "State after close");
  }

  // ── Fetch funding records (frozen post-close in --execute) ──
  const allRecords =
    (await launchpad.launchpad.account.fundingRecord.all()) as OnChainFundingRecord[];
  const records = allRecords.filter((r) => r.account.launch.equals(launchAddr));
  if (records.length === 0)
    throw new Error("No funding records found for this launch");
  logger.info({ records: records.length }, "Funding records fetched");

  // ── Compute + print allocation ──
  const funderRecords: AccumulatorFundingRecord[] = records.map((r) => ({
    funder: r.account.funder,
    committedAmount: r.account.committedAmount,
    committedAmountAccumulator: r.account.committedAmountAccumulator,
    lastAccumulatorUpdate: r.account.lastAccumulatorUpdate,
  }));
  const result = computeAllocation(
    funderRecords,
    preAllocated,
    TOTAL_ALLOCATION,
    account.unixTimestampStarted!, // guaranteed set — checked after fetch, immutable across close
    new BN(account.secondsForLaunch),
    new BN(account.accumulatorActivationDelaySeconds),
    boostConfig,
    fundEvents,
  );
  printAllocationTable(result, TOTAL_ALLOCATION, account.unixTimestampStarted!);
  writeAllocationJson(ALLOCATION_OUT_FILE, result);
  logger.info(
    { file: "allocation.out.json", funders: result.lines.length },
    "Wrote allocation audit file",
  );

  if (!EXECUTE) {
    logger.info(
      {},
      "Dry-run complete — no transactions sent. Re-run with --execute to crank on-chain.",
    );
    return;
  }

  // ── EXECUTE: launch must be Closed to set approvals ──
  const state = launchState(account);
  if (state !== "closed") {
    throw new Error(
      `Launch is "${state}", not "closed" (min raise not met?) — cannot approve.`,
    );
  }

  // ── Approve (the allocation). credible stops here: the launch is left Closed with
  //    the allocation set. completeLaunch + performance package are done manually. ──
  if (
    !confirmYes(
      `Approve ${result.approvals.length} funders for ${fmtUsdc(TOTAL_ALLOCATION)}?`,
    )
  )
    return abort();
  logger.info(
    { approvals: result.approvals.length },
    "Sending approval batches",
  );
  const { maxConfirmedSlot } = await approveFundingRecords(
    launchpad,
    connection,
    payer,
    launchAddr,
    result.approvals,
  );

  // Verify total_approved == TOTAL_ALLOCATION on-chain (read-your-writes safe):
  // probe unpinned first, then re-read pinned to the max confirmed batch slot if
  // it looks short (a lagging replica under-reports but never over-reports).
  let refreshed = await fetchLaunchAtSlot(connection, launchpad, launchAddr, 0);
  if (refreshed.totalApprovedAmount.lt(TOTAL_ALLOCATION)) {
    refreshed = await fetchLaunchAtSlot(
      connection,
      launchpad,
      launchAddr,
      maxConfirmedSlot,
    );
  }
  if (!refreshed.totalApprovedAmount.eq(TOTAL_ALLOCATION)) {
    throw new Error(
      `total_approved_amount (${refreshed.totalApprovedAmount.toString()}) != TOTAL_ALLOCATION (${TOTAL_ALLOCATION.toString()}) — allocation did not land exactly`,
    );
  }
  logger.info(
    { totalApproved: refreshed.totalApprovedAmount.toString() },
    "Allocation set — launch left Closed for manual completeLaunch + performance package",
  );
}

main().catch((err) => {
  logger.error(
    { err: err instanceof Error ? err.message : String(err) },
    "credible failed",
  );
  process.exit(1);
});
