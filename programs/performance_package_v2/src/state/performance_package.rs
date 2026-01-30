use anchor_lang::prelude::*;

use crate::{PerformancePackageError, MAX_TRANCHES};

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

impl OracleReader {
    /// Records the start snapshot when unlock begins.
    /// For Time oracle, this is a no-op since it just reads current time on demand.
    pub fn record_start(&mut self) -> Result<()> {
        match self {
            OracleReader::Time => {
                // No-op for Time oracle - just reads current time on demand
                Ok(())
            }
        }
    }

    /// Records the end snapshot when unlock completes.
    /// For Time oracle, this is a no-op since it just reads current time on demand.
    pub fn record_end(&mut self) -> Result<()> {
        match self {
            OracleReader::Time => {
                // No-op for Time oracle - just reads current time on demand
                Ok(())
            }
        }
    }

    /// Checks if the minimum duration has passed and unlock can be completed.
    /// For Time oracle, always returns true (no min_duration concept).
    pub fn can_end(&self) -> bool {
        match self {
            OracleReader::Time => true,
        }
    }

    /// Computes the oracle value for reward calculation.
    /// For Time oracle, returns the current unix timestamp.
    pub fn compute_value(&self) -> Result<u128> {
        match self {
            OracleReader::Time => {
                let clock = Clock::get()?;
                Ok(clock.unix_timestamp as u128)
            }
        }
    }

    /// Resets the oracle state for the next unlock cycle.
    /// For Time oracle, this is a no-op (no state to reset).
    pub fn reset(&mut self) {
        match self {
            OracleReader::Time => {
                // No-op for Time oracle - no state to reset
            }
        }
    }
}

impl RewardFunction {
    /// Calculates the cumulative rewards earned for a given oracle value.
    /// Returns total tokens deserved so far (not incremental).
    pub fn calculate(&self, value: u128) -> Result<u64> {
        match self {
            RewardFunction::CliffLinear {
                start_value,
                cliff_value,
                end_value,
                cliff_amount,
                total_amount,
            } => {
                // Before start: 0 rewards
                if value < *start_value {
                    return Ok(0);
                }

                // Before cliff: 0 rewards
                if value < *cliff_value {
                    return Ok(0);
                }

                // At or after end: full rewards
                if value >= *end_value {
                    return Ok(*total_amount);
                }

                // Between cliff and end: cliff_amount + linear interpolation
                // linear_portion = (value - cliff_value) / (end_value - cliff_value) * (total_amount - cliff_amount)

                let value_progress = value.checked_sub(*cliff_value).unwrap_or(0);
                let value_range = end_value
                    .checked_sub(*cliff_value)
                    .ok_or(PerformancePackageError::RewardCalculationOverflow)?;

                // Avoid division by zero
                if value_range == 0 {
                    return Ok(*cliff_amount);
                }

                let linear_amount = (*total_amount as u128)
                    .checked_sub(*cliff_amount as u128)
                    .ok_or(PerformancePackageError::RewardCalculationOverflow)?;

                // Calculate: cliff_amount + (value_progress * linear_amount / value_range)
                let linear_portion = value_progress
                    .checked_mul(linear_amount)
                    .ok_or(PerformancePackageError::RewardCalculationOverflow)?
                    .checked_div(value_range)
                    .ok_or(PerformancePackageError::RewardCalculationOverflow)?;

                let result = (*cliff_amount as u128)
                    .checked_add(linear_portion)
                    .ok_or(PerformancePackageError::RewardCalculationOverflow)?;

                // Safe to convert since total_amount is u64 and result <= total_amount
                Ok(result as u64)
            }
            RewardFunction::Threshold { tranches } => {
                // Find the highest threshold that value meets
                let mut cumulative = 0u64;
                for tranche in tranches.iter() {
                    if value >= tranche.threshold {
                        cumulative = tranche.cumulative_amount;
                    } else {
                        break;
                    }
                }
                Ok(cumulative)
            }
        }
    }
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
