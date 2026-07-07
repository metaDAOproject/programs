import { PublicKey } from "@solana/web3.js";

// Token Details
export const TOKEN_SEED = "MFKO9GdJSBjq8CWO";

// Team Config Details
export const TEAM_ADDRESS = new PublicKey("11111111111111111111111111111111"); // Credible team squads address

export const SPENDING_MEMBERS = [
  new PublicKey("44dNkVJsWPZfh3tvRyqpnwgkoL5RYqi3cWsE1d8wfviV"),
  new PublicKey("4uhwwcipVRFczcCPCgZDkMgWaL8kGw7ht4k6HT3faw3g"),
  new PublicKey("Fhz78PivwNKJ6JjCbNRj1QKEdgutecaQW8SqV54SkbgK"),
];
// Even without a performance package, defaults need to be set
export const PERFORMANCE_PACKAGE_GRANTEE = new PublicKey(
  "11111111111111111111111111111111", // Placeholder for no performance package
);

// Amount Details
export const MIN_GOAL = 2_000_000; // 2M USDC
export const SPENDING_LIMIT = 250_000; // 250k USDC
export const PERFORMANCE_PACKAGE_TOKEN_AMOUNT = 4_532_678; // 4_532_678 CRED
export const PERFORMANCE_PACKAGE_UNLOCK_MONTHS = 18; // 18 months
export const ADDITIONAL_CARVEOUT = 5_230_709; // 5_230_709 CRED
export const ADDITIONAL_CARVEOUT_RECIPIENT = new PublicKey(
  "DVA4Q78r3N35gHFeKyMWEMP9jtv4f5joteDz3kMZTYjL",
); // Established Multisig For Credible Launch
// 2/3 Kollan Proph3t Pileks

export const TOKEN_NAME = "Credible Finance";
export const TOKEN_SYMBOL = "CRED";
export const TOKEN_URI =
  "https://raw.githubusercontent.com/metaDAOproject/programs/refs/heads/develop/scripts/assets/CRED/CRED.json";
