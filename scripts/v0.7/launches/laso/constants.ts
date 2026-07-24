import { PublicKey } from "@solana/web3.js";

import type { LaunchConfig } from "../../launch/types.js";

export const ALLOCATION_STRATEGY = "prealloc-accum" as const;
export const AUTHORITY_KEY_ENV = "LASO_AUTHORITY_KEY";

export const TOKEN_SEED = "7VpRX8sqCTEmdAa9";

// Filled after initialize — derive with status / initialize output
export const TOKEN_ADDRESS = new PublicKey("11111111111111111111111111111111");

export const LAUNCH_AUTHORITY = new PublicKey(
  "11111111111111111111111111111111",
);

export const TEAM_ADDRESS = new PublicKey(
  "82MdwSmh7JEK9cywZusE27m8zwbhmkR9Bs38jQoAwwCc",
);

export const LAUNCH_ADDRESS = new PublicKey(
  "3UU7HP5NwWTznkZ5CqNBpSnKu7Jyzt1YqB2RpreDjWcp",
);

export const LUT_ADDRESS = new PublicKey("11111111111111111111111111111111");

export const SPENDING_MEMBERS = [
  new PublicKey("4XMTsBivE5V73ScmuChGVLS6oF8MFb2P3fvR3gt9So9J"),
];

export const PERFORMANCE_PACKAGE_GRANTEE = new PublicKey(
  "11111111111111111111111111111111",
);

export const MIN_GOAL = 750_000;
export const SPENDING_LIMIT = 50_000;
export const PERFORMANCE_PACKAGE_TOKEN_AMOUNT = 1;
export const TOTAL_ALLOCATION = 1_000_000;
export const PERFORMANCE_PACKAGE_UNLOCK_MONTHS = 24;
export const ADDITIONAL_CARVEOUT = 27_100_000;
export const ADDITIONAL_CARVEOUT_RECIPIENT = new PublicKey(
  "91PL1BRM2jGbt6jxv56hhkAFbvsHMHLirMXDQCQcvY92",
);
export const LAUNCH_DAYS = 4;

export const TOKEN_NAME = "Laso Finance";
export const TOKEN_SYMBOL = "LASO";
export const TOKEN_URI =
  "https://raw.githubusercontent.com/metaDAOproject/programs/refs/heads/develop/scripts/assets/LASO/LASO.json";

export const PREALLOC_CSV = "./ico-pref.csv";

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
  PREALLOC_CSV,
  BOOST,
} satisfies Omit<LaunchConfig, "name">;
