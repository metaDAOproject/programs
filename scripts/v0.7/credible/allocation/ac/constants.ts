/** Number of decimal places for USDC on Solana. */
export const USDC_DECIMALS = 6;

/** Multiplier to convert whole USDC units to on-chain lamport amounts. */
export const USDC_SCALAR = 10 ** USDC_DECIMALS;

/** Number of decimal places for launch tokens (same as USDC). */
export const TOKEN_DECIMALS = 6;

/** Multiplier to convert whole token units to on-chain lamport amounts. */
export const TOKEN_SCALAR = 10 ** TOKEN_DECIMALS;

/**
 * Total tokens allocated to participants in a launch.
 * From the on-chain program: 10,000,000 * TOKEN_SCALE = 10,000,000,000,000 atoms.
 * Used in claim.rs: token_amount = (approved_amount * TOKENS_TO_PARTICIPANTS) / total_approved_amount
 */
export const TOKENS_TO_PARTICIPANTS = 10_000_000 * TOKEN_SCALAR;

/**
 * Buffer (in seconds) added to time-based checks before sending
 * on-chain instructions. Accounts for clock drift between our
 * local time and the Solana cluster clock, avoiding premature
 * tx failures that would burn retries.
 */
export const CLOCK_DRIFT_BUFFER_SECONDS = 10;

/**
 * Max funding record approvals per transaction batch.
 * Each ix is small (~16k CUs), but each adds 2 unique accounts
 * (funder + funding_record PDA) × 32 bytes. At batch size 10:
 * ~4 shared + 20 unique = 24 accounts × 32 = 768 bytes, fitting
 * comfortably within Solana's 1232-byte legacy tx limit.
 */
export const APPROVAL_BATCH_SIZE = 10;

/**
 * Priority fee in microlamports per compute unit.
 * Configurable via PRIORITY_FEE_MICRO_LAMPORTS env var.
 * Default 10,000 — enough to land during moderate congestion
 * without burning SOL on high-batch-count launches (~0.13 SOL
 * for a 725-funder launch across 73 approval batches + completeLaunch).
 */
export const PRIORITY_FEE_MICRO_LAMPORTS = parseInt(
  process.env.PRIORITY_FEE_MICRO_LAMPORTS ?? "10000",
  10,
);

// ── Boost configuration ──
// Fill-based boost for accumulator-weighted approvals. Rewards "finder"
// funders who committed when the pool was still sparse.
// Set BOOST_MULTIPLIER > 1 to enable. When 1, no boost is applied.

/**
 * Peak multiplier when pool is empty. 1 = no boost (plain accumulator).
 * Example: 10 means early funders' accumulators are weighted up to 10x.
 */
export const BOOST_MULTIPLIER = parseFloat(
  process.env.BOOST_MULTIPLIER ?? "10",
);

/**
 * Cumulative/target ratio where boost decays to 1x. Must be > 0.
 * 1 = boost ends at target. 3 = boost persists until 3x oversubscribed.
 */
export const BOOST_FILL_CEILING = parseFloat(
  process.env.BOOST_FILL_CEILING ?? "3",
);

/**
 * Hours after each funder's entry to measure fill level. 0 = measure at fund time.
 * Converted to seconds when constructing BoostConfig.
 * Example: 1 means fill is measured 1 hour after each funder's commitment.
 */
export const BOOST_LOOK_AHEAD_HOURS = parseFloat(
  process.env.BOOST_LOOK_AHEAD_HOURS ?? "1",
);

// ── Jito bundle retry constants ──

/** Jito block engine base URL for bundle submission. */
export const JITO_BLOCK_ENGINE_URL =
  "https://mainnet.block-engine.jito.wtf/api/v1/bundles";

/**
 * SOL tip sent to a random Jito tip account when retrying via bundle.
 * Configurable via JITO_TIP_SOL env var. Default: 0.01 SOL.
 */
export const JITO_TIP_LAMPORTS = Math.round(
  parseFloat(process.env.JITO_TIP_SOL ?? "0.01") * 1_000_000_000,
);

/** Max attempts to poll Jito for bundle confirmation before giving up. */
export const JITO_BUNDLE_POLL_ATTEMPTS = 30;

/** Milliseconds between Jito bundle status polls. */
export const JITO_BUNDLE_POLL_INTERVAL_MS = 2_000;
