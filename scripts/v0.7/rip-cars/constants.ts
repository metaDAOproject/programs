import { PublicKey } from "@solana/web3.js";

// Token Details
export const TOKEN_SEED = "TVOzl2TKhXCRVn9U";
export const TOKEN_ADDRESS = new PublicKey(
  "CARSsxWPkpQWvfyRBwfGMGvysJBHdHGfE46X5MNgmeta",
);

export const LAUNCH_AUTHORITY = new PublicKey(
  "LncRyJVBbek7EFhnd6QNZRTLT9mReKWPGCpsfu5bqJS",
);

// Team Config Details
export const TEAM_ADDRESS = new PublicKey(
  "CnTDWPAEsN5RAgNapTJerDAc45TWavRQ1m3ACMpukYPd",
); // Rip Cars team squads address

export const LAUNCH_ADDRESS = new PublicKey(
  "8uMemVUT1ToSuda2jBVhcaPmJWq5C3bKe7DhrM5wkqZP",
);

export const SPENDING_MEMBERS = [
  new PublicKey("CqK6aBSSycQU3igvptxvhf9YNC1v5EodCuCxuVLPPohh"),
  new PublicKey("4Huto5Lv8z59tW4EezrYNSvBJhCc9U5bgmR5yH5csFDc"),
];
// Even without a performance package, defaults need to be set
export const PERFORMANCE_PACKAGE_GRANTEE = new PublicKey(
  "7iiE6ncVh5uJuBKw7JcwCjhUT8o2VT2JMeQZ8Tsi5Ckf",
);

// Amount Details
export const MIN_GOAL = 250_000; // 250k USDC
export const SPENDING_LIMIT = 40_000; // 40k USDC
export const PERFORMANCE_PACKAGE_TOKEN_AMOUNT = 12_900_000; // 12.9M CARS
export const TOTAL_ALLOCATION = 250_000; // 250k USDC
export const PERFORMANCE_PACKAGE_UNLOCK_MONTHS = 18; // 18 months
export const ADDITIONAL_CARVEOUT = null; // 0 CARS
export const ADDITIONAL_CARVEOUT_RECIPIENT = undefined;
export const LAUNCH_DAYS = 4;

export const TOKEN_NAME = "Rip Cars";
export const TOKEN_SYMBOL = "CARS";
export const TOKEN_URI =
  "https://raw.githubusercontent.com/metaDAOproject/programs/refs/heads/develop/scripts/assets/CARS/CARS.json";
