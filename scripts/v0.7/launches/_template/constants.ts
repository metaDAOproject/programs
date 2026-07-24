import { PublicKey } from "@solana/web3.js";

import type { LaunchConfig } from "../../launch/types.js";

/**
 * Copy this folder to launches/<your-launch>/ and fill in every field.
 * Run: bun scripts/v0.7/launch/cli.ts <your-launch> status
 */

export const ALLOCATION_STRATEGY = "nash" as const; // or "prealloc-accum"
export const AUTHORITY_KEY_ENV = "LAUNCH_AUTHORITY_KEY";

export const TOKEN_SEED = "CHANGE_ME_SEED16"; // must yield desired mint with authority

export const TOKEN_ADDRESS = new PublicKey("11111111111111111111111111111111");
export const LAUNCH_AUTHORITY = new PublicKey(
  "11111111111111111111111111111111",
);
export const LAUNCH_ADDRESS = new PublicKey("11111111111111111111111111111111");
export const LUT_ADDRESS = new PublicKey("11111111111111111111111111111111");

export const TEAM_ADDRESS = new PublicKey("11111111111111111111111111111111");
export const SPENDING_MEMBERS = [TEAM_ADDRESS];
export const PERFORMANCE_PACKAGE_GRANTEE = TEAM_ADDRESS;

export const MIN_GOAL = 100_000;
export const SPENDING_LIMIT = 10_000;
export const PERFORMANCE_PACKAGE_TOKEN_AMOUNT = 1;
export const TOTAL_ALLOCATION = 100_000;
export const PERFORMANCE_PACKAGE_UNLOCK_MONTHS = 18;
export const ADDITIONAL_CARVEOUT = null;
export const ADDITIONAL_CARVEOUT_RECIPIENT = undefined;
export const LAUNCH_DAYS = 4;

export const TOKEN_NAME = "Example";
export const TOKEN_SYMBOL = "EX";
export const TOKEN_URI =
  "https://raw.githubusercontent.com/metaDAOproject/programs/refs/heads/develop/scripts/assets/EXAMPLE/EXAMPLE.json";

export const NASH = {
  ownershipSplit: 0.5,
  epsilon: 1,
  reactivity: 0.4,
  startMode: "rand" as const,
  seed: 20260723,
  scoreColumn: "ownership_points" as const,
};

// export const PREALLOC_CSV = "./ico-pref.csv"; // for prealloc-accum

export const BOOST = {
  multiplier: 10,
  fillCeiling: 3,
  lookAheadHours: 1,
};

export const config = {
  ALLOCATION_STRATEGY,
  AUTHORITY_KEY_ENV,
  TOKEN_SEED,
  TOKEN_ADDRESS,
  LAUNCH_AUTHORITY,
  LAUNCH_ADDRESS,
  LUT_ADDRESS,
  TEAM_ADDRESS,
  SPENDING_MEMBERS,
  PERFORMANCE_PACKAGE_GRANTEE,
  MIN_GOAL,
  SPENDING_LIMIT,
  PERFORMANCE_PACKAGE_TOKEN_AMOUNT,
  TOTAL_ALLOCATION,
  PERFORMANCE_PACKAGE_UNLOCK_MONTHS,
  ADDITIONAL_CARVEOUT,
  ADDITIONAL_CARVEOUT_RECIPIENT,
  LAUNCH_DAYS,
  TOKEN_NAME,
  TOKEN_SYMBOL,
  TOKEN_URI,
  NASH,
  BOOST,
} satisfies Omit<LaunchConfig, "name">;
