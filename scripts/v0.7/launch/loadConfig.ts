import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { LaunchConfig } from "./types.js";
import { isUnsetPubkey } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const LAUNCHES_DIR = join(HERE, "..", "launches");

/**
 * Dynamically import launches/<name>/constants.ts and normalize into LaunchConfig.
 * Accepts either a flat export surface matching LaunchConfig fields, or a default
 * / named `config` export.
 */
export async function loadLaunchConfig(name: string): Promise<LaunchConfig> {
  const dir = join(LAUNCHES_DIR, name);
  const constantsPath = join(dir, "constants.ts");
  if (!existsSync(constantsPath)) {
    throw new Error(
      `Launch config not found: ${constantsPath}\n` +
        `Expected scripts/v0.7/launches/${name}/constants.ts`,
    );
  }

  const mod = await import(resolve(constantsPath));
  const raw: Record<string, unknown> = mod.config ?? mod.default ?? mod;

  const required = [
    "ALLOCATION_STRATEGY",
    "AUTHORITY_KEY_ENV",
    "TOKEN_SEED",
    "TOKEN_ADDRESS",
    "LAUNCH_AUTHORITY",
    "LAUNCH_ADDRESS",
    "LUT_ADDRESS",
    "TEAM_ADDRESS",
    "SPENDING_MEMBERS",
    "PERFORMANCE_PACKAGE_GRANTEE",
    "MIN_GOAL",
    "SPENDING_LIMIT",
    "PERFORMANCE_PACKAGE_TOKEN_AMOUNT",
    "PERFORMANCE_PACKAGE_UNLOCK_MONTHS",
    "TOTAL_ALLOCATION",
    "LAUNCH_DAYS",
    "TOKEN_NAME",
    "TOKEN_SYMBOL",
    "TOKEN_URI",
  ] as const;

  for (const key of required) {
    if (raw[key] === undefined && mod[key] === undefined) {
      throw new Error(`launches/${name}/constants.ts missing export: ${key}`);
    }
  }

  const pick = <T>(key: string): T =>
    (raw[key] !== undefined ? raw[key] : mod[key]) as T;

  const config: LaunchConfig = {
    name,
    ALLOCATION_STRATEGY: pick("ALLOCATION_STRATEGY"),
    AUTHORITY_KEY_ENV: pick("AUTHORITY_KEY_ENV"),
    TOKEN_SEED: pick("TOKEN_SEED"),
    TOKEN_ADDRESS: pick("TOKEN_ADDRESS"),
    LAUNCH_AUTHORITY: pick("LAUNCH_AUTHORITY"),
    LAUNCH_ADDRESS: pick("LAUNCH_ADDRESS"),
    LUT_ADDRESS: pick("LUT_ADDRESS"),
    TEAM_ADDRESS: pick("TEAM_ADDRESS"),
    SPENDING_MEMBERS: pick("SPENDING_MEMBERS"),
    PERFORMANCE_PACKAGE_GRANTEE: pick("PERFORMANCE_PACKAGE_GRANTEE"),
    MIN_GOAL: pick("MIN_GOAL"),
    SPENDING_LIMIT: pick("SPENDING_LIMIT"),
    PERFORMANCE_PACKAGE_TOKEN_AMOUNT: pick("PERFORMANCE_PACKAGE_TOKEN_AMOUNT"),
    PERFORMANCE_PACKAGE_UNLOCK_MONTHS: pick(
      "PERFORMANCE_PACKAGE_UNLOCK_MONTHS",
    ),
    TOTAL_ALLOCATION: pick("TOTAL_ALLOCATION"),
    ADDITIONAL_CARVEOUT: pick("ADDITIONAL_CARVEOUT") ?? null,
    ADDITIONAL_CARVEOUT_RECIPIENT: pick("ADDITIONAL_CARVEOUT_RECIPIENT"),
    LAUNCH_DAYS: pick("LAUNCH_DAYS"),
    TOKEN_NAME: pick("TOKEN_NAME"),
    TOKEN_SYMBOL: pick("TOKEN_SYMBOL"),
    TOKEN_URI: pick("TOKEN_URI"),
    NASH: pick("NASH"),
    PREALLOC_CSV: pick("PREALLOC_CSV"),
    BOOST: pick("BOOST"),
    EXTEND_DURATION_SECONDS: pick("EXTEND_DURATION_SECONDS"),
  };

  if (
    config.ALLOCATION_STRATEGY !== "nash" &&
    config.ALLOCATION_STRATEGY !== "prealloc-accum"
  ) {
    throw new Error(
      `Unknown ALLOCATION_STRATEGY '${config.ALLOCATION_STRATEGY}' (expected nash | prealloc-accum)`,
    );
  }

  return config;
}

export function launchDir(name: string): string {
  return join(LAUNCHES_DIR, name);
}

export function requireLaunchAddress(config: LaunchConfig): void {
  if (isUnsetPubkey(config.LAUNCH_ADDRESS)) {
    throw new Error(
      `LAUNCH_ADDRESS is unset in launches/${config.name}/constants.ts — paste it after initialize`,
    );
  }
}

export function requireLutAddress(config: LaunchConfig): void {
  if (isUnsetPubkey(config.LUT_ADDRESS)) {
    throw new Error(
      `LUT_ADDRESS is unset in launches/${config.name}/constants.ts — run end and paste the ALT address`,
    );
  }
}
