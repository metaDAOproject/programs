/** Number of decimal places for USDC on Solana. */
export const USDC_DECIMALS = 6;

/** Multiplier to convert whole USDC units to on-chain lamport amounts. */
export const USDC_SCALAR = 10 ** USDC_DECIMALS;

/**
 * Buffer (in seconds) added to time-based checks before sending
 * on-chain instructions. Accounts for clock drift.
 */
export const CLOCK_DRIFT_BUFFER_SECONDS = 10;

/**
 * Max funding record approvals per transaction batch.
 * Each ix is small (~16k CUs), but each adds 2 unique accounts.
 */
export const APPROVAL_BATCH_SIZE = 10;

/**
 * Priority fee in microlamports per compute unit.
 * Configurable via PRIORITY_FEE_MICRO_LAMPORTS env var.
 */
export const PRIORITY_FEE_MICRO_LAMPORTS = parseInt(
  process.env.PRIORITY_FEE_MICRO_LAMPORTS ?? "10000",
  10,
);
