import type { LaunchpadClient } from "@metadaoproject/programs/launchpad/v0.7";
import {
  LAMPORTS_PER_SOL,
  type Connection,
  type PublicKey,
} from "@solana/web3.js";
import BN from "bn.js";

/** Mirrors launch/types UNSET sentinel without importing from v0.7. */
const UNSET = "11111111111111111111111111111111";

export interface LaunchConfigLike {
  TOTAL_ALLOCATION: number;
  LUT_ADDRESS: PublicKey;
  name?: string;
}

export function launchStateKey(
  state: Record<string, unknown> | null | undefined,
): string {
  if (!state) return "missing";
  return Object.keys(state)[0] ?? "unknown";
}

export async function assertMinSolBalance(
  connection: Connection,
  pubkey: PublicKey,
  minSol = 0.001,
): Promise<number> {
  const balance = await connection.getBalance(pubkey);
  const sol = balance / LAMPORTS_PER_SOL;
  console.log("Payer address:", pubkey.toBase58());
  console.log("Balance:", sol, "SOL");
  if (balance < LAMPORTS_PER_SOL * minSol) {
    throw new Error(
      `Insufficient balance. Please fund the address with at least ${minSol} SOL`,
    );
  }
  return sol;
}

export async function assertTokenMatchesConstants(
  derived: PublicKey,
  expected: PublicKey,
): Promise<void> {
  if (!derived.equals(expected)) {
    throw new Error(
      `Token address mismatch: derived ${derived.toBase58()} !== constants TOKEN_ADDRESS ${expected.toBase58()}`,
    );
  }
}

export interface CompletePrecheckResult {
  ok: boolean;
  messages: string[];
}

/** Pre-checks for completeLaunch — prints issues; does not throw when ok=false. */
export async function precheckComplete(
  launchpad: LaunchpadClient,
  connection: Connection,
  config: LaunchConfigLike,
  launch: PublicKey,
): Promise<CompletePrecheckResult> {
  const messages: string[] = [];
  let ok = true;

  if (config.LUT_ADDRESS.toBase58() === UNSET) {
    ok = false;
    messages.push(
      "LUT_ADDRESS is unset — run end and paste the ALT into constants",
    );
  } else {
    const lut = await connection.getAddressLookupTable(config.LUT_ADDRESS);
    if (!lut.value) {
      ok = false;
      messages.push(`LUT ${config.LUT_ADDRESS.toBase58()} not found on-chain`);
    }
  }

  const account = await launchpad.fetchLaunch(launch);
  if (!account) {
    return { ok: false, messages: ["Launch account not found"] };
  }

  const state = launchStateKey(account.state as Record<string, unknown>);
  if (state !== "closed") {
    ok = false;
    messages.push(`Launch state is "${state}", complete requires Closed`);
  }

  const target = new BN(config.TOTAL_ALLOCATION).mul(new BN(1_000_000));
  if (!account.totalApprovedAmount.eq(target)) {
    ok = false;
    messages.push(
      `totalApprovedAmount (${account.totalApprovedAmount.toString()}) !== TOTAL_ALLOCATION atoms (${target.toString()}) — run allocate --execute`,
    );
  }

  if (ok) {
    messages.push("Pre-checks passed — ready to complete");
  }
  return { ok, messages };
}
