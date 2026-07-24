/**
 * Shared allocation CLI shell.
 *
 * Flow (strategy-agnostic):
 *   1. Fetch launch
 *   2. --execute + live → confirm + closeLaunch (freeze funders)
 *   3. Fetch records + DB inputs → strategy.compute
 *   4. Dry-run stops; --execute approves + verifies totalApproved
 *   5. Leaves Closed — does NOT completeLaunch
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

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
} from "./allocation/ac/constants";
import {
  approveFundingRecords,
  fetchLaunchAtSlot,
  type FundingApproval,
} from "./allocation/ac/fundingApproval";
import { fetchFundEvents, fetchOwnershipScores } from "./allocation/db";
import { log } from "./allocation/logger";
import {
  computeAllocation as computeNash,
  type BoostConfig as NashBoost,
  type NashStartMode,
  type RipCarsFundingRecord,
} from "./allocation/strategies/nash";
import { computeAllocation as computePrealloc } from "./allocation/strategies/preallocAccum";
import type { AccumulatorFundingRecord } from "./allocation/ac/accumulator";
import type { BoostConfig as AccumBoost } from "./allocation/ac/accumulator";
import {
  confirmYes,
  fmtUsdc,
  getSysvarClockTime,
  loadKeypair,
  loadPreAllocations,
  printNashTable,
  printPreallocTable,
  usdc,
  writeAllocationJson,
} from "./allocation/utils";
import { launchDir, requireLaunchAddress } from "./loadConfig.js";
import type { LaunchConfig } from "./types.js";

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

function launchState(account: LaunchAccount): string {
  return Object.keys(account.state as Record<string, unknown>)[0] ?? "unknown";
}

function defaultBoost(config: LaunchConfig): {
  multiplier: number;
  fillCeiling: number;
  lookAheadSeconds: number;
} {
  return {
    multiplier: config.BOOST?.multiplier ?? 10,
    fillCeiling: config.BOOST?.fillCeiling ?? 3,
    lookAheadSeconds: (config.BOOST?.lookAheadHours ?? 1) * 3600,
  };
}

export async function allocateLaunch(
  config: LaunchConfig,
  opts: { execute?: boolean } = {},
): Promise<void> {
  requireLaunchAddress(config);

  const dir = launchDir(config.name);
  const envPath = join(dir, ".env");
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath, override: true });
  }

  const EXECUTE = opts.execute === true;
  const TOTAL_ALLOCATION = usdc(config.TOTAL_ALLOCATION);
  if (TOTAL_ALLOCATION.isZero()) {
    throw new Error("TOTAL_ALLOCATION must be > 0 in constants");
  }

  const logger = log.child({ module: `allocate:${config.name}` });
  const ALLOCATION_OUT_FILE = join(dir, "allocation.out.json");

  const RPC_URL = requireEnv("RPC_URL");
  const PG_URL = requireEnv("FUTARCHY_PG_URL");
  const launchAddr = config.LAUNCH_ADDRESS;

  const loadPayer = (): anchor.Wallet => {
    if (!EXECUTE) return new anchor.Wallet(Keypair.generate());
    return new anchor.Wallet(loadKeypair(requireEnv(config.AUTHORITY_KEY_ENV)));
  };

  const payer = loadPayer();
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, payer, {
    commitment: "confirmed",
  });
  const launchpad = LaunchpadClient.createClient({ provider });

  const fetchLaunch = async (): Promise<LaunchAccount> =>
    (await launchpad.launchpad.account.launch.fetch(
      launchAddr,
    )) as LaunchAccount;

  const closeExpiredLaunch = async (account: LaunchAccount): Promise<void> => {
    const now = await getSysvarClockTime(connection);
    const closeTime =
      account.unixTimestampStarted!.toNumber() + account.secondsForLaunch;
    if (now < closeTime + CLOCK_DRIFT_BUFFER_SECONDS) {
      throw new Error(
        `Launch not yet expired (clock ${now} < close ${closeTime})`,
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
  };

  logger.info(
    {
      mode: EXECUTE ? "EXECUTE" : "DRY-RUN",
      strategy: config.ALLOCATION_STRATEGY,
      wallet: payer.publicKey.toBase58(),
      rpc: RPC_URL,
      launch: launchAddr.toBase58(),
    },
    "allocate starting",
  );

  let account = await fetchLaunch();
  if (!account.unixTimestampStarted) {
    throw new Error("Launch has no start timestamp");
  }
  logger.info(
    {
      state: launchState(account),
      minimumRaiseAmount: account.minimumRaiseAmount.toString(),
      totalApprovedAmount: account.totalApprovedAmount.toString(),
      totalAllocation: TOTAL_ALLOCATION.toString(),
    },
    "Launch fetched",
  );

  // DB before any write
  const fundEvents = await fetchFundEvents(PG_URL, launchAddr.toBase58());

  if (EXECUTE && launchState(account) === "live") {
    if (
      !confirmYes(
        "Launch is not closed. Close it now? (freezes the funder set)",
      )
    ) {
      logger.info({}, "Aborted — no further transactions sent.");
      return;
    }
    await closeExpiredLaunch(account);
    account = await fetchLaunch();
    logger.info({ state: launchState(account) }, "State after close");
  }

  const allRecords =
    (await launchpad.launchpad.account.fundingRecord.all()) as OnChainFundingRecord[];
  const records = allRecords.filter((r) => r.account.launch.equals(launchAddr));
  if (records.length === 0) {
    throw new Error("No funding records found for this launch");
  }
  logger.info({ records: records.length }, "Funding records fetched");

  const boost = defaultBoost(config);
  let approvals: FundingApproval[] = [];

  if (config.ALLOCATION_STRATEGY === "nash") {
    const nash = config.NASH ?? {
      ownershipSplit: 0.5,
      epsilon: 1,
      reactivity: 0.4,
      startMode: "rand" as NashStartMode,
      seed: 20260723,
      scoreColumn: "ownership_points" as const,
    };
    if (
      nash.startMode !== "acc" &&
      nash.startMode !== "own" &&
      nash.startMode !== "rand"
    ) {
      throw new Error(`NASH.startMode must be acc|own|rand`);
    }

    const scores = await fetchOwnershipScores(PG_URL, nash.scoreColumn);
    const funderRecords: RipCarsFundingRecord[] = records.map((r) => ({
      funder: r.account.funder,
      committedAmount: r.account.committedAmount,
      committedAmountAccumulator: r.account.committedAmountAccumulator,
      lastAccumulatorUpdate: r.account.lastAccumulatorUpdate,
      score: scores.get(r.account.funder.toBase58()) ?? 0,
    }));

    const nashBoost: NashBoost = boost;
    const result = computeNash(funderRecords, fundEvents, {
      totalAllocation: TOTAL_ALLOCATION,
      ownershipSplit: nash.ownershipSplit,
      epsilon: nash.epsilon,
      reactivity: nash.reactivity,
      startMode: nash.startMode,
      seed: nash.seed,
      boost: nashBoost,
      launchStartTime: account.unixTimestampStarted!,
      secondsForLaunch: new BN(account.secondsForLaunch),
      accumulatorActivationDelaySeconds: new BN(
        account.accumulatorActivationDelaySeconds,
      ),
    });

    printNashTable(result, TOTAL_ALLOCATION, account.unixTimestampStarted!);
    writeAllocationJson(ALLOCATION_OUT_FILE, result.lines);
    approvals = result.approvals;
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
  } else {
    const csvRel = config.PREALLOC_CSV ?? "./ico-pref.csv";
    const csvPath = join(dir, csvRel);
    if (!existsSync(csvPath)) {
      throw new Error(
        `PREALLOC_CSV not found: ${csvPath} (set PREALLOC_CSV in constants)`,
      );
    }
    const preAllocated = loadPreAllocations(csvPath);
    const accumRecords: AccumulatorFundingRecord[] = records.map((r) => ({
      funder: r.account.funder,
      committedAmount: r.account.committedAmount,
      committedAmountAccumulator: r.account.committedAmountAccumulator,
      lastAccumulatorUpdate: r.account.lastAccumulatorUpdate,
    }));
    const accumBoost: AccumBoost = boost;
    const result = computePrealloc(
      accumRecords,
      preAllocated,
      TOTAL_ALLOCATION,
      account.unixTimestampStarted!,
      new BN(account.secondsForLaunch),
      new BN(account.accumulatorActivationDelaySeconds),
      accumBoost,
      fundEvents,
    );

    printPreallocTable(result, TOTAL_ALLOCATION, account.unixTimestampStarted!);
    writeAllocationJson(ALLOCATION_OUT_FILE, result.lines);
    approvals = result.approvals;
    logger.info(
      {
        file: "allocation.out.json",
        funders: result.lines.length,
        preAllocated: result.preAllocatedTotal.toString(),
      },
      "Wrote allocation audit file",
    );
  }

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
      `Approve ${approvals.length} funders for ${fmtUsdc(TOTAL_ALLOCATION)}?`,
    )
  ) {
    logger.info({}, "Aborted — no further transactions sent.");
    return;
  }

  logger.info({ approvals: approvals.length }, "Sending approval batches");
  const { maxConfirmedSlot } = await approveFundingRecords(
    launchpad,
    connection,
    payer,
    launchAddr,
    approvals,
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
      `total_approved_amount (${refreshed.totalApprovedAmount.toString()}) != TOTAL_ALLOCATION (${TOTAL_ALLOCATION.toString()})`,
    );
  }
  logger.info(
    { totalApproved: refreshed.totalApprovedAmount.toString() },
    "Allocation set — launch left Closed for manual complete + perfPackage",
  );
}
