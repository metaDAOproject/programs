/**
 * ripcars — allocate the Rip Cars launch via congestion-game Nash equilibrium,
 * then optionally approve funding records on-chain.
 *
 * Flow (mirrors laso / credible allocation CLI):
 *   1. Fetch the launch.
 *   2. --execute: if the launch is still live + expired, confirm and closeLaunch
 *      FIRST — freezes the funder set so a late fund can't invalidate allocation.
 *   3. Fetch funding records (chain) + fund events + ownership scores (DB).
 *   4. Allocate via Nash congestion game (ownership road vs accumulator road).
 *   5. Dry-run stops here. --execute confirms + sends setFundingRecordApproval
 *      batches, then verifies total_approved == TOTAL_ALLOCATION on-chain.
 *
 * Stops after setting the allocation — does NOT completeLaunch. Launch is left
 * Closed; completeLaunch + performance package are done manually afterward.
 *
 * Run:
 *   bun install
 *   bun ripcars.ts               # dry run (default)
 *   bun ripcars.ts --execute     # set allocation (requires RIPCARS_AUTHORITY_KEY)
 */
import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad/v0.7";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import BN from "bn.js";
import { config as loadDotenv } from "dotenv";

import {
  CLOCK_DRIFT_BUFFER_SECONDS,
  PRIORITY_FEE_MICRO_LAMPORTS,
} from "./ac/constants";
import { approveFundingRecords, fetchLaunchAtSlot } from "./ac/fundingApproval";
import {
  computeAllocation,
  type BoostConfig,
  type NashStartMode,
  type RipCarsFundingRecord,
} from "./allocation";
import { fetchFundEvents, fetchOwnershipScores } from "./db";
import { log } from "./logger";
import {
  confirmYes,
  fmtUsdc,
  getSysvarClockTime,
  loadKeypair,
  printAllocationTable,
  usdc,
  writeAllocationJson,
} from "./utils";
import {
  LAUNCH_ADDRESS as DEFAULT_LAUNCH,
  TOTAL_ALLOCATION as DEFAULT_POOL,
} from "../constants";

/** Audit file: the exact per-funder allocation this run computed. */
const ALLOCATION_OUT_FILE = `${import.meta.dir}/allocation.out.json`;

loadDotenv({ path: `${import.meta.dir}/.env`, override: true });

/*************************************************
 * ***********************************************
 * If you see the stars, it means...
 ***********************************************/
/** The launch to allocate (base58). Live (expired), Closed, or Complete. */
/****************************************************** */
const LAUNCH_ADDRESS = DEFAULT_LAUNCH.toBase58(); // Rip Cars ***** TRIPLE CHECK *****
const TOTAL_ALLOCATION = usdc(DEFAULT_POOL); //************** KOLLAN CHANGE ME ***********/

// Congestion game (same knobs as nash_equilibrium_sim.html defaults).
const OWNERSHIP_SPLIT = Number(
  process.env.OWNERSHIP_SPLIT ?? process.env.OWNERSHIP_FLOOR_FRACTION ?? "0.5",
);
const NASH_EPSILON = Number(process.env.NASH_EPSILON ?? "1");
const NASH_REACT = Number(process.env.NASH_REACT ?? "0.40"); // HTML "Reactivity"
const NASH_START = (process.env.NASH_START ?? "rand") as NashStartMode; // HTML default
const NASH_SEED = Number(process.env.NASH_SEED ?? "20260723");
const SCORE_COLUMN = (process.env.SCORE_COLUMN ?? "ownership_points") as
  | "ownership_points"
  | "total_usd_value_days";

// ── Accumulator boost (weights for the accumulator road) ──
const BOOST_MULTIPLIER = Number(process.env.BOOST_MULTIPLIER ?? "10");
const BOOST_FILL_CEILING = Number(process.env.BOOST_FILL_CEILING ?? "3");
const BOOST_LOOK_AHEAD_HOURS = Number(
  process.env.BOOST_LOOK_AHEAD_HOURS ?? "1",
);

// ─────────────────────────────────────────────────────────────────────────────

const logger = log.child({ module: "ripcars" });

const boostConfig: BoostConfig = {
  multiplier: BOOST_MULTIPLIER,
  fillCeiling: BOOST_FILL_CEILING,
  lookAheadSeconds: BOOST_LOOK_AHEAD_HOURS * 3600,
};

type LaunchAccount = Awaited<
  ReturnType<LaunchpadClient["launchpad"]["account"]["launch"]["fetch"]>
> & {
  accumulatorActivationDelaySeconds: number;
};

type OnChainFundingRecord = Awaited<
  ReturnType<LaunchpadClient["launchpad"]["account"]["fundingRecord"]["all"]>
>[number] & {
  account: {
    committedAmountAccumulator: BN;
    lastAccumulatorUpdate: BN;
  };
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required (.env)`);
  return value;
}

function loadPayer(): anchor.Wallet {
  if (!EXECUTE) return new anchor.Wallet(Keypair.generate());
  return new anchor.Wallet(loadKeypair(requireEnv("RIPCARS_AUTHORITY_KEY")));
}

function launchState(account: LaunchAccount): string {
  return Object.keys(account.state as Record<string, unknown>)[0] ?? "unknown";
}

async function fetchLaunch(): Promise<LaunchAccount> {
  return (await launchpad.launchpad.account.launch.fetch(
    launchAddr,
  )) as LaunchAccount;
}

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

function abort(): void {
  logger.info({}, "Aborted — no further transactions sent.");
}

const EXECUTE = process.argv.includes("--execute");

if (TOTAL_ALLOCATION.isZero())
  throw new Error("Set TOTAL_ALLOCATION at the top of this file");
if (
  SCORE_COLUMN !== "ownership_points" &&
  SCORE_COLUMN !== "total_usd_value_days"
) {
  throw new Error(
    `SCORE_COLUMN must be ownership_points or total_usd_value_days (got '${SCORE_COLUMN}')`,
  );
}

const RPC_URL = requireEnv("RPC_URL");
const PG_URL = requireEnv("FUTARCHY_PG_URL");
const launchAddr = new PublicKey(LAUNCH_ADDRESS);
const payer = loadPayer();
const connection = new Connection(RPC_URL, "confirmed");
const provider = new anchor.AnchorProvider(connection, payer, {
  commitment: "confirmed",
});
const launchpad = LaunchpadClient.createClient({ provider });

async function main(): Promise<void> {
  if (NASH_START !== "acc" && NASH_START !== "own" && NASH_START !== "rand") {
    throw new Error(`NASH_START must be acc|own|rand (got '${NASH_START}')`);
  }

  logger.info(
    {
      mode: EXECUTE ? "EXECUTE" : "DRY-RUN",
      wallet: payer.publicKey.toBase58(),
      rpc: RPC_URL,
      launch: LAUNCH_ADDRESS,
      ownershipSplit: OWNERSHIP_SPLIT,
      epsilon: NASH_EPSILON,
      reactivity: NASH_REACT,
      startMode: NASH_START,
      seed: NASH_SEED,
      scoreColumn: SCORE_COLUMN,
      boost: boostConfig,
    },
    "ripcars starting",
  );

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

  // DB reads before any on-chain write so a DB failure aborts cleanly.
  const [fundEvents, scores] = await Promise.all([
    fetchFundEvents(PG_URL, LAUNCH_ADDRESS),
    fetchOwnershipScores(PG_URL, SCORE_COLUMN),
  ]);

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

  const allRecords =
    (await launchpad.launchpad.account.fundingRecord.all()) as OnChainFundingRecord[];
  const records = allRecords.filter((r) => r.account.launch.equals(launchAddr));
  if (records.length === 0)
    throw new Error("No funding records found for this launch");
  logger.info({ records: records.length }, "Funding records fetched");

  const funderRecords: RipCarsFundingRecord[] = records.map((r) => ({
    funder: r.account.funder,
    committedAmount: r.account.committedAmount,
    committedAmountAccumulator: r.account.committedAmountAccumulator,
    lastAccumulatorUpdate: r.account.lastAccumulatorUpdate,
    score: scores.get(r.account.funder.toBase58()) ?? 0,
  }));
  const scored = funderRecords.filter((r) => r.score > 0).length;
  logger.info(
    { scored, unscored: funderRecords.length - scored },
    "Ownership scores joined",
  );

  const result = computeAllocation(funderRecords, fundEvents, {
    totalAllocation: TOTAL_ALLOCATION,
    ownershipSplit: OWNERSHIP_SPLIT,
    epsilon: NASH_EPSILON,
    reactivity: NASH_REACT,
    startMode: NASH_START,
    seed: NASH_SEED,
    boost: boostConfig,
    launchStartTime: account.unixTimestampStarted!,
    secondsForLaunch: new BN(account.secondsForLaunch),
    accumulatorActivationDelaySeconds: new BN(
      account.accumulatorActivationDelaySeconds,
    ),
  });

  printAllocationTable(result, TOTAL_ALLOCATION, account.unixTimestampStarted!);
  writeAllocationJson(ALLOCATION_OUT_FILE, result);
  logger.info(
    {
      file: "allocation.out.json",
      funders: result.lines.length,
      ownership: result.ownershipCount,
      atNash: result.atNash,
      rounds: result.rounds,
    },
    "Wrote allocation audit file",
  );

  if (!EXECUTE) {
    logger.info(
      {},
      "Dry-run complete — no transactions sent. Re-run with --execute to approve on-chain.",
    );
    return;
  }

  const state = launchState(account);
  if (state !== "closed") {
    throw new Error(
      `Launch is "${state}", not "closed" (min raise not met?) — cannot approve.`,
    );
  }

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
    "ripcars failed",
  );
  process.exit(1);
});
