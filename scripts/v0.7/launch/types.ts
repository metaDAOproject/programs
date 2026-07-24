import type { PublicKey } from "@solana/web3.js";

/** Allocation strategy selected from per-launch constants. */
export type AllocationStrategyName = "nash" | "prealloc-accum";

export type NashStartMode = "acc" | "own" | "rand";
export type ScoreColumn = "ownership_points" | "total_usd_value_days";

export interface BoostConfig {
  multiplier: number;
  fillCeiling: number;
  lookAheadHours: number;
}

export interface NashConfig {
  ownershipSplit: number;
  epsilon: number;
  reactivity: number;
  startMode: NashStartMode;
  seed: number;
  scoreColumn: ScoreColumn;
}

/**
 * Per-launch constants contract. Each launches/<name>/constants.ts should
 * export these fields (strategy-specific knobs may be omitted when unused).
 */
export interface LaunchConfig {
  /** Launch folder name — used for logging / env path resolution. */
  name: string;

  ALLOCATION_STRATEGY: AllocationStrategyName;
  /** Env var holding the launch-authority secret (base58 or JSON byte array). */
  AUTHORITY_KEY_ENV: string;

  TOKEN_SEED: string;
  /** Expected mint; initialize asserts derive(seed) === this. */
  TOKEN_ADDRESS: PublicKey;
  LAUNCH_AUTHORITY: PublicKey;
  /** Paste after initialize. SystemProgram default means "not set yet". */
  LAUNCH_ADDRESS: PublicKey;
  /** Paste after end (ALT creation). SystemProgram default means "not set yet". */
  LUT_ADDRESS: PublicKey;

  TEAM_ADDRESS: PublicKey;
  SPENDING_MEMBERS: PublicKey[];
  PERFORMANCE_PACKAGE_GRANTEE: PublicKey;

  /** Whole USDC units (not atoms). */
  MIN_GOAL: number;
  SPENDING_LIMIT: number;
  /** Whole token units (6 decimals). */
  PERFORMANCE_PACKAGE_TOKEN_AMOUNT: number;
  PERFORMANCE_PACKAGE_UNLOCK_MONTHS: number;
  /** Whole USDC units for the allocation pool. */
  TOTAL_ALLOCATION: number;
  /** Whole token units, or null if unused. */
  ADDITIONAL_CARVEOUT: number | null;
  ADDITIONAL_CARVEOUT_RECIPIENT: PublicKey | undefined;
  LAUNCH_DAYS: number;

  TOKEN_NAME: string;
  TOKEN_SYMBOL: string;
  TOKEN_URI: string;

  /** Optional — used when ALLOCATION_STRATEGY === "nash". */
  NASH?: NashConfig;
  /** Optional — path relative to the launch folder, for prealloc-accum. */
  PREALLOC_CSV?: string;
  BOOST?: BoostConfig;

  /**
   * Optional seconds to extend via MetaDAO multisig (extendLaunch helper).
   * Defaults to 1 day when unset.
   */
  EXTEND_DURATION_SECONDS?: number;
}

/** System-program pubkey used as a "not filled in yet" sentinel. */
export const UNSET_PUBKEY = "11111111111111111111111111111111";

export function isUnsetPubkey(key: PublicKey): boolean {
  return key.toBase58() === UNSET_PUBKEY;
}
