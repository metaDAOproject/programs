import { PublicKey } from "@solana/web3.js";

import type { LaunchConfig } from "../../launch/types.js";

export const ALLOCATION_STRATEGY = "nash" as const;
export const AUTHORITY_KEY_ENV = "RIPCARS_AUTHORITY_KEY";

export const TOKEN_SEED = "TVOzl2TKhXCRVn9U";
export const TOKEN_ADDRESS = new PublicKey(
  "CARSsxWPkpQWvfyRBwfGMGvysJBHdHGfE46X5MNgmeta",
);

export const LAUNCH_AUTHORITY = new PublicKey(
  "LncRyJVBbek7EFhnd6QNZRTLT9mReKWPGCpsfu5bqJS",
);

export const TEAM_ADDRESS = new PublicKey(
  "CnTDWPAEsN5RAgNapTJerDAc45TWavRQ1m3ACMpukYPd",
);

export const LAUNCH_ADDRESS = new PublicKey(
  "8uMemVUT1ToSuda2jBVhcaPmJWq5C3bKe7DhrM5wkqZP",
);

export const LUT_ADDRESS = new PublicKey("11111111111111111111111111111111");

export const SPENDING_MEMBERS = [
  new PublicKey("CqK6aBSSycQU3igvptxvhf9YNC1v5EodCuCxuVLPPohh"),
  new PublicKey("4Huto5Lv8z59tW4EezrYNSvBJhCc9U5bgmR5yH5csFDc"),
];

export const PERFORMANCE_PACKAGE_GRANTEE = new PublicKey(
  "7iiE6ncVh5uJuBKw7JcwCjhUT8o2VT2JMeQZ8Tsi5Ckf",
);

export const MIN_GOAL = 250_000;
export const SPENDING_LIMIT = 40_000;
export const PERFORMANCE_PACKAGE_TOKEN_AMOUNT = 12_900_000;
export const TOTAL_ALLOCATION = 250_000;
export const PERFORMANCE_PACKAGE_UNLOCK_MONTHS = 18;
export const ADDITIONAL_CARVEOUT = null;
export const ADDITIONAL_CARVEOUT_RECIPIENT = undefined;
export const LAUNCH_DAYS = 4;

export const TOKEN_NAME = "Rip Cars";
export const TOKEN_SYMBOL = "CARS";
export const TOKEN_URI =
  "https://raw.githubusercontent.com/metaDAOproject/programs/refs/heads/develop/scripts/assets/CARS/CARS.json";

export const NASH = {
  ownershipSplit: 0.5,
  epsilon: 1,
  reactivity: 0.4,
  startMode: "rand" as const,
  seed: 20260723,
  scoreColumn: "ownership_points" as const,
};

export const BOOST = {
  multiplier: 10,
  fillCeiling: 3,
  lookAheadHours: 1,
};

/** Convenience object matching LaunchConfig (name filled by loader). */
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
