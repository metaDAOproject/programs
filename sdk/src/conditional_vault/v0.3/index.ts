// Note: v0.3's vault PDA is derived from a (settlementAuthority, mint) pair and
// has binary pass/fail mints (`getVaultFinalizeMintAddr`/`getVaultRevertMintAddr`).
// v0.4+ replaced this with a multi-outcome `Question` model where the vault is
// derived from (question, mint) and conditional tokens are addressed by index.
// The two are not interchangeable.
export * from "./types/index.js";
export * from "./pda.js";
export * from "./ConditionalVaultClient.js";
