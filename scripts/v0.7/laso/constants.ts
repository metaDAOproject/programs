import { PublicKey } from "@solana/web3.js";

// Token Details
export const TOKEN_SEED = "7VpRX8sqCTEmdAa9";

// Team Config Details
export const TEAM_ADDRESS = new PublicKey(
  "82MdwSmh7JEK9cywZusE27m8zwbhmkR9Bs38jQoAwwCc",
); // Laso team address

export const SPENDING_MEMBERS = [
  new PublicKey("3jRKUoyN8CDA4DngXV3Ym2ZfZKzCP87XVgXKtQJADMws"),
];
// Even without a performance package, defaults need to be set
export const PERFORMANCE_PACKAGE_GRANTEE = new PublicKey(
  "11111111111111111111111111111111", // Placeholder for no performance package
);

// Amount Details
export const MIN_GOAL = 750_000; // 750K USDC
export const SPENDING_LIMIT = 50_000; // 50k USDC
export const PERFORMANCE_PACKAGE_TOKEN_AMOUNT = 1; // 1 LASO
export const PERFORMANCE_PACKAGE_UNLOCK_MONTHS = 24; // 24 months
export const ADDITIONAL_CARVEOUT = 27_100_000; // 27.1M LASO
export const ADDITIONAL_CARVEOUT_RECIPIENT = new PublicKey(
  "91PL1BRM2jGbt6jxv56hhkAFbvsHMHLirMXDQCQcvY92",
); // Established Multisig For Laso Launch
// 2/3 Kollan Proph3t Pileks

export const TOKEN_NAME = "Laso Finance";
export const TOKEN_SYMBOL = "LASO";
export const TOKEN_URI =
  "https://raw.githubusercontent.com/metaDAOproject/programs/refs/heads/develop/scripts/assets/LASO/LASO.json";
