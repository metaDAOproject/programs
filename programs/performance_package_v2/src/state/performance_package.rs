use anchor_lang::prelude::*;

use crate::MAX_TRANCHES;

/// Lifecycle state for the performance package.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PackageStatus {
    /// Ready to start (or waiting for min_unlock_timestamp)
    Locked,
    /// Unlock in progress, waiting for min_duration
    Unlocking,
}

/// Oracle reader that knows how to read from an external oracle account.
/// Extracts a `value: u128` for reward calculations.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub enum OracleReader {
    /// Reads current timestamp from Clock::get()
    /// No state needed - just reads current time on demand
    Time,
    // FutarchyTwap variant will be added in Phase 9
}

/// A threshold tranche for step-based rewards.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub struct ThresholdTranche {
    /// Oracle value threshold
    pub threshold: u128,
    /// Total tokens at this level (cumulative, not incremental)
    pub cumulative_amount: u64,
}

/// Reward function that calculates cumulative rewards from oracle values.
/// Returns total tokens deserved so far (not incremental).
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub enum RewardFunction {
    /// Cliff + Linear: cliff_amount at cliff_value, then linear accrual to total_amount at end_value
    /// Works with any oracle value (e.g., time, price, or other metrics)
    /// For no-cliff behavior, set cliff_value = start_value and cliff_amount = 0
    CliffLinear {
        start_value: u128,
        cliff_value: u128,
        end_value: u128,
        cliff_amount: u64,
        /// Total amount including cliff
        total_amount: u64,
    },
    /// Threshold-based tranches (similar to v1)
    /// Each tranche: if value >= threshold, cumulative reward = amount
    Threshold {
        /// Must be sorted by threshold ascending
        #[max_len(MAX_TRANCHES)]
        tranches: Vec<ThresholdTranche>,
    },
}

/// The main account representing a performance package.
/// Acts as the `authorized_minter` in mint_governor.
/// Seeds: `["performance_package", create_key]`
#[account]
#[derive(InitSpace, Debug)]
pub struct PerformancePackage {
    // === Core References ===
    /// Token mint controlled by mint_governor
    pub mint: Pubkey,
    /// MintGovernor account
    pub mint_governor: Pubkey,
    /// MintAuthority PDA for this PP
    pub mint_authority: Pubkey,

    // === Authorities ===
    /// DAO multisig vault - can modify PP
    pub authority: Pubkey,
    /// Team multisig - receives minted tokens
    pub recipient: Pubkey,

    // === Inline Configuration ===
    /// Stores start/end snapshots for oracle calculations
    pub oracle_reader: OracleReader,
    /// How to calculate rewards
    pub reward_function: RewardFunction,

    // === Lifecycle ===
    /// Locked or Unlocking
    pub status: PackageStatus,
    /// Can't start unlock before this time
    pub min_unlock_timestamp: i64,

    // === Payout Tracking ===
    /// Cumulative tokens minted to recipient
    pub total_rewards_paid_out: u64,
    /// Event sequence number
    pub seq_num: u64,

    // === PDA ===
    /// Used for PDA derivation
    pub create_key: Pubkey,
    pub bump: u8,
}
