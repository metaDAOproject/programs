/**
 * Local surfpool test harness for credible.ts. One command, one matched run:
 *   setup (override authority + airdrop + timetravel) → credible.ts --execute → verify.
 *
 * Prerequisites:
 *   1. A FRESH local surfpool forking mainnet, e.g.:
 *        SURFPOOL_DATASOURCE_RPC_URL=<mainnet-rpc> surfpool start --no-tui --no-deploy -y
 *   2. .env RPC_URL pointed at that local surfpool (http://127.0.0.1:8899).
 *
 * Run:  bun test.ts
 *
 * Because the allocation table and the crank both come from credible.ts's single
 * fetch, they cannot diverge. This harness only sets up the launch so the crank
 * can run (credible's real authority isn't held) and verifies the on-chain result.
 */
import { readFileSync, writeFileSync } from "node:fs";

import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad/v0.7";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import bs58 from "bs58";
import { config as loadDotenv } from "dotenv";

import { loadPreAllocations, type AllocationRow } from "./utils";

const ENV_PATH = `${import.meta.dir}/.env`;
loadDotenv({ path: ENV_PATH });

const RPC = process.env.RPC_URL!;
const LAUNCH = new PublicKey("");
const CLOSE_TIME = 1783184423; // unixTimestampStarted + secondsForLaunch
const TARGET_ATOMS = new BN(""); // TOTAL_ALLOCATION (1M USDC), must match credible.ts
const PRE_ALLOCATED = loadPreAllocations(`${import.meta.dir}/ico-pref.csv`); // base58 → fixed atoms

/** Guard: cheatcodes must only ever hit a local surfpool, never staging/mainnet. */
function assertLocal(): void {
  if (!RPC.includes("127.0.0.1") && !RPC.includes("localhost")) {
    throw new Error(
      `RPC_URL is not local surfpool (${RPC}) — refusing to run cheatcodes`,
    );
  }
}

async function cheat<T>(method: string, params: unknown[]): Promise<T> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = (await r.json()) as { error?: { message: string }; result: T };
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

const conn = new Connection(RPC, "confirmed");
const launchpad = LaunchpadClient.createClient({
  provider: new anchor.AnchorProvider(
    conn,
    new anchor.Wallet(Keypair.generate()),
    { commitment: "confirmed" },
  ),
});

/**
 * Setup: credible's real launch authority isn't held, so override it to a throwaway
 * key (byte-patched in place — the SDK's encoder truncates trailing fields, so
 * decode/encode can't be used), airdrop it, timetravel past close, write the key.
 */
async function setup(): Promise<void> {
  assertLocal();
  const kp = Keypair.generate();
  console.log("throwaway authority:", kp.publicKey.toBase58());

  await cheat("surfnet_setAccount", [
    kp.publicKey.toBase58(),
    { lamports: 100_000_000_000 },
  ]);

  const info = await conn.getAccountInfo(LAUNCH);
  if (!info) throw new Error("launch not found (is surfpool forking mainnet?)");
  // Patch whatever the CURRENT authority is (idempotent — works on a fresh fork
  // or after a prior override), rather than assuming the real mainnet authority.
  const current = (await launchpad.launchpad.account.launch.fetch(
    LAUNCH,
  )) as unknown as { launchAuthority: PublicKey };
  const authBytes = current.launchAuthority.toBuffer();
  const buf = Buffer.from(info.data);
  const occurrences: number[] = [];
  let idx = buf.indexOf(authBytes, 0);
  while (idx !== -1) {
    occurrences.push(idx);
    idx = buf.indexOf(authBytes, idx + 1);
  }
  if (occurrences.length !== 1)
    throw new Error(
      `expected 1 authority occurrence, got ${occurrences.length}`,
    );
  kp.publicKey.toBuffer().copy(buf, occurrences[0]!);
  await cheat("surfnet_setAccount", [
    LAUNCH.toBase58(),
    {
      data: buf.toString("hex"),
      owner: info.owner.toBase58(),
      lamports: info.lamports,
      executable: false,
    },
  ]);

  const after = (await launchpad.launchpad.account.launch.fetch(
    LAUNCH,
  )) as unknown as { launchAuthority: PublicKey };
  if (!after.launchAuthority.equals(kp.publicKey))
    throw new Error("authority override failed");
  console.log("authority overridden ✓");

  await cheat("surfnet_timeTravel", [
    { absoluteTimestamp: (CLOSE_TIME + 300) * 1000 },
  ]);
  const clock = await cheat<{
    value: { data: { parsed: { info: { unixTimestamp: number } } } };
  }>("getAccountInfo", [
    "SysvarC1ock11111111111111111111111111111111",
    { encoding: "jsonParsed" },
  ]);
  const t = clock.value.data.parsed.info.unixTimestamp;
  if (t <= CLOSE_TIME)
    throw new Error(`timetravel failed: clock ${t} <= close ${CLOSE_TIME}`);
  console.log(`timetravel ✓ (clock ${t} > close ${CLOSE_TIME})`);

  const env = readFileSync(ENV_PATH, "utf8").replace(
    /^CREDIBLE_AUTHORITY_KEY=.*$/m,
    `CREDIBLE_AUTHORITY_KEY=${bs58.encode(kp.secretKey)}`,
  );
  writeFileSync(ENV_PATH, env);
}

/** Verify the on-chain allocation invariants after the crank. */
async function verify(): Promise<void> {
  const launch = (await launchpad.launchpad.account.launch.fetch(
    LAUNCH,
  )) as unknown as {
    state: Record<string, unknown>;
    totalApprovedAmount: BN;
  };
  // credible leaves the launch Closed (completeLaunch is manual), with the full allocation set.
  const state = Object.keys(launch.state)[0];
  const totalOk = launch.totalApprovedAmount.eq(TARGET_ATOMS);
  console.log(
    `\nstate: ${state} ${state === "closed" ? "✓" : "✗ (expected closed)"} | ` +
      `launch.totalApprovedAmount: ${launch.totalApprovedAmount.toString()} ${totalOk ? "✓" : "✗"}`,
  );
  if (state !== "closed")
    throw new Error(
      `expected launch to be "closed" after credible, got "${state}"`,
    );
  if (!totalOk)
    throw new Error(`totalApprovedAmount != ${TARGET_ATOMS.toString()}`);

  const all = await launchpad.launchpad.account.fundingRecord.all();
  const recs = all.filter((r) =>
    (r.account as unknown as { launch: PublicKey }).launch.equals(LAUNCH),
  );
  let sum = new BN(0);
  let overCap = 0;
  let negatives = 0;
  for (const r of recs) {
    const a = r.account as unknown as {
      approvedAmount: BN;
      committedAmount: BN;
    };
    sum = sum.add(a.approvedAmount);
    if (a.approvedAmount.gt(a.committedAmount)) overCap++;
    if (a.approvedAmount.isNeg()) negatives++;
  }
  console.log(
    `records: ${recs.length} | Σ approved: ${sum.toString()} ${sum.eq(TARGET_ATOMS) ? "✓" : "✗"} | over-cap: ${overCap} | negatives: ${negatives}`,
  );

  // Each pre-allocated wallet's on-chain approved must equal its CSV amount (capped at committed).
  let preMismatch = 0;
  for (const [addr, csvAmount] of PRE_ALLOCATED) {
    const r = recs.find(
      (x) =>
        (x.account as unknown as { funder: PublicKey }).funder.toBase58() ===
        addr,
    );
    if (!r) {
      console.log(`  ${addr}  NOT FOUND ✗`);
      preMismatch++;
      continue;
    }
    const a = r.account as unknown as {
      approvedAmount: BN;
      committedAmount: BN;
    };
    const expected = BN.min(csvAmount, a.committedAmount);
    if (!a.approvedAmount.eq(expected)) preMismatch++;
  }
  console.log(
    `pre-alloc: ${PRE_ALLOCATED.size} wallets | approved == CSV amount (capped): ${preMismatch === 0 ? "✓" : `✗ ${preMismatch} off`}`,
  );
  if (preMismatch > 0)
    throw new Error(
      `${preMismatch} pre-allocated wallets did not get their CSV amount`,
    );

  // Full per-funder read-back: every on-chain approvedAmount must equal exactly
  // what credible computed (allocation.out.json). Catches a funder↔amount swap that
  // Σ + caps alone would miss.
  const audit = JSON.parse(
    readFileSync(`${import.meta.dir}/allocation.out.json`, "utf8"),
  ) as AllocationRow[];
  const onChainApproved = new Map(
    recs.map((r) => {
      const a = r.account as unknown as {
        funder: PublicKey;
        approvedAmount: BN;
      };
      return [a.funder.toBase58(), a.approvedAmount.toString()];
    }),
  );
  let mismatches = 0;
  let missingOnChain = 0;
  for (const row of audit) {
    const onChain = onChainApproved.get(row.funder);
    if (onChain === undefined) missingOnChain++;
    else if (onChain !== row.approved) mismatches++;
  }
  const auditFunders = new Set(audit.map((r) => r.funder));
  const extraOnChain = [...onChainApproved.keys()].filter(
    (f) => !auditFunders.has(f),
  ).length;
  console.log(
    `per-funder read-back: ${audit.length} audited | mismatches: ${mismatches} | missing on-chain: ${missingOnChain} | on-chain not in audit (approved 0): ${extraOnChain}`,
  );
  if (mismatches > 0 || missingOnChain > 0) {
    throw new Error(
      `per-funder allocation mismatch: ${mismatches} differ, ${missingOnChain} missing on-chain`,
    );
  }
}

async function main(): Promise<void> {
  console.log("── setup ──");
  await setup();

  // --setup-only: just prep surfpool (override authority, timetravel, write key)
  // so you can then drive `bun credible.ts --execute` by hand and hit the y/n prompts.
  if (process.argv.includes("--setup-only")) {
    console.log(
      "\nSetup complete. Now run:  bun credible.ts --execute   (or: bun credible.ts for a dry run)",
    );
    return;
  }

  console.log("\n── credible.ts --execute ──");
  // --execute prompts before each on-chain step (close, approve); feed "yes"
  // for each so the harness runs unattended. Extra lines are harmless.
  const proc = Bun.spawnSync(["bun", "credible.ts", "--execute"], {
    cwd: import.meta.dir,
    stdin: Buffer.from("yes\nyes\n"),
    stdout: "inherit",
    stderr: "inherit",
  });
  if (proc.exitCode !== 0)
    throw new Error(`credible.ts --execute exited ${proc.exitCode}`);

  console.log("\n── verify ──");
  await verify();
}

main().catch((err) => {
  console.error(
    "test failed:",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
