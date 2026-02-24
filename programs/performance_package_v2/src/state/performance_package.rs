use anchor_lang::prelude::*;
use futarchy::state::{Dao, PoolState};

use crate::{PerformancePackageError, MAX_MIN_DURATION, MAX_TRANCHES};

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
    /// Reads accumulator from Futarchy AMM, computes TWAP
    /// Two snapshots: start (on start_unlock) and end (on complete_unlock)
    /// TWAP = (end_value - start_value) / (end_time - start_time)
    FutarchyTwap {
        /// The Futarchy DAO account to read (contains embedded AMM)
        amm: Pubkey,
        /// Minimum seconds between start and end
        min_duration: u32,
        /// Start snapshot (recorded on start_unlock)
        start_value: u128,
        start_time: i64,
        /// End snapshot (recorded on complete_unlock)
        end_value: u128,
        end_time: i64,
    },
}

/// Reads the effective aggregator value from a Futarchy DAO account.
/// Extrapolates the aggregator to the current timestamp using the last observation.
fn read_futarchy_aggregator(
    remaining_accounts: &[AccountInfo],
    expected_amm: &Pubkey,
) -> Result<(u128, i64)> {
    // Get the DAO account from remaining_accounts
    let dao_account = remaining_accounts
        .first()
        .ok_or(PerformancePackageError::OracleMissingAccount)?;

    // Verify the account key matches the configured amm
    require_keys_eq!(
        dao_account.key(),
        *expected_amm,
        PerformancePackageError::OracleInvalidAccount
    );

    // Deserialize the Dao account
    let dao_data = dao_account.try_borrow_data()?;
    let dao = Dao::try_deserialize(&mut &dao_data[..])
        .map_err(|_| PerformancePackageError::OracleParseError)?;

    // Read the spot oracle
    let oracle = match &dao.amm.state {
        PoolState::Spot { spot } | PoolState::Futarchy { spot, .. } => &spot.oracle,
    };

    // Ensure the oracle's start delay has passed before reading the aggregator.
    // During the delay period, the aggregator stays at zero while the observation
    // tracks price changes. Reading it during or right after the delay would
    // produce an artificially low effective aggregator, distorting the TWAP.
    let clock = Clock::get()?;
    let twap_start_timestamp = oracle.created_at_timestamp + oracle.start_delay_seconds as i64;
    require!(
        clock.unix_timestamp >= twap_start_timestamp,
        PerformancePackageError::OracleInvalidState
    );
    let time_since_update = clock
        .unix_timestamp
        .saturating_sub(oracle.last_updated_timestamp) as u128;
    let effective_aggregator = oracle
        .aggregator
        .wrapping_add(oracle.last_observation.saturating_mul(time_since_update));

    Ok((effective_aggregator, clock.unix_timestamp))
}

impl OracleReader {
    /// Validates the oracle reader configuration.
    pub fn validate(&self) -> Result<()> {
        match self {
            &OracleReader::Time => {
                // Time oracle has no configuration to validate
                Ok(())
            }
            &OracleReader::FutarchyTwap { min_duration, .. } => {
                // min_duration must be > 0 to avoid division by zero in TWAP calculation
                require!(
                    min_duration > 0,
                    PerformancePackageError::InvalidVestingSchedule
                );
                require_gte!(
                    MAX_MIN_DURATION,
                    min_duration,
                    PerformancePackageError::MinDurationTooLarge
                );
                Ok(())
            }
        }
    }

    /// Records the start snapshot when unlock begins.
    /// For Time oracle, this is a no-op since it just reads current time on demand.
    /// For FutarchyTwap, reads the accumulator from the Dao's spot pool oracle.
    pub fn record_start(&mut self, remaining_accounts: &[AccountInfo]) -> Result<()> {
        match self {
            OracleReader::Time => {
                // No-op for Time oracle - just reads current time on demand
                Ok(())
            }
            OracleReader::FutarchyTwap {
                amm,
                start_value,
                start_time,
                ..
            } => {
                let (effective_aggregator, timestamp) =
                    read_futarchy_aggregator(remaining_accounts, amm)?;
                *start_value = effective_aggregator;
                *start_time = timestamp;
                Ok(())
            }
        }
    }

    /// Records the end snapshot when unlock completes.
    /// For Time oracle, this is a no-op since it just reads current time on demand.
    /// For FutarchyTwap, reads the accumulator from the Dao's spot pool oracle.
    pub fn record_end(&mut self, remaining_accounts: &[AccountInfo]) -> Result<()> {
        match self {
            OracleReader::Time => {
                // No-op for Time oracle - just reads current time on demand
                Ok(())
            }
            OracleReader::FutarchyTwap {
                amm,
                end_value,
                end_time,
                ..
            } => {
                let (effective_aggregator, timestamp) =
                    read_futarchy_aggregator(remaining_accounts, amm)?;
                *end_value = effective_aggregator;
                *end_time = timestamp;

                Ok(())
            }
        }
    }

    /// Checks if the minimum duration has passed and unlock can be completed.
    /// For Time oracle, always returns true (no min_duration concept).
    /// For FutarchyTwap, checks if min_duration seconds have passed since start_time.
    pub fn can_end(&self) -> bool {
        match self {
            OracleReader::Time => true,
            OracleReader::FutarchyTwap {
                min_duration,
                start_time,
                ..
            } => {
                // record_start() has not been called yet
                if *start_time == 0 {
                    return false;
                }
                let clock = Clock::get();
                match clock {
                    Ok(clock) => {
                        let elapsed = clock.unix_timestamp.saturating_sub(*start_time);
                        elapsed >= *min_duration as i64
                    }
                    Err(_) => false,
                }
            }
        }
    }

    /// Computes the oracle value for reward calculation.
    /// For Time oracle, returns the current unix timestamp.
    /// For FutarchyTwap, returns the TWAP = (end_value - start_value) / (end_time - start_time).
    pub fn compute_value(&self) -> Result<u128> {
        match self {
            OracleReader::Time => {
                let clock = Clock::get()?;

                Ok(clock.unix_timestamp as u128)
            }
            OracleReader::FutarchyTwap {
                start_value,
                start_time,
                end_value,
                end_time,
                ..
            } => {
                let time_delta = end_time - start_time;

                // Ensure time_delta > 0 to avoid division by zero
                require!(time_delta > 0, PerformancePackageError::OracleInvalidState);

                // Calculate TWAP: (end_value - start_value) / time_delta
                // Note: end_value should always be >= start_value since aggregator is cumulative
                // If end_value < start_value, the aggregator wrapped - rare but possible
                // wrapping_sub ensures we get the correct difference despite wrapping
                let value_delta = end_value.wrapping_sub(*start_value);

                let twap = value_delta / time_delta as u128;

                Ok(twap)
            }
        }
    }

    /// Resets the oracle state for the next unlock cycle.
    /// For Time oracle, this is a no-op (no state to reset).
    /// For FutarchyTwap, clears the start and end snapshots.
    pub fn reset(&mut self) {
        match self {
            OracleReader::Time => {}
            OracleReader::FutarchyTwap {
                start_value,
                start_time,
                end_value,
                end_time,
                ..
            } => {
                *start_value = 0;
                *start_time = 0;
                *end_value = 0;
                *end_time = 0;
            }
        }
    }
}

impl RewardFunction {
    /// Validates the reward function configuration.
    pub fn validate(&self) -> Result<()> {
        match self {
            RewardFunction::CliffLinear {
                start_value,
                cliff_value,
                end_value,
                cliff_amount,
                total_amount,
            } => {
                // start_value <= cliff_value <= end_value
                require!(
                    start_value <= cliff_value && cliff_value <= end_value,
                    PerformancePackageError::InvalidVestingSchedule
                );

                // cliff_amount <= total_amount
                require!(
                    cliff_amount <= total_amount,
                    PerformancePackageError::InvalidVestingSchedule
                );
            }
            RewardFunction::Threshold { tranches } => {
                // Must have at least one tranche
                require!(
                    !tranches.is_empty(),
                    PerformancePackageError::InvalidTranches
                );

                // Tranches must be sorted by threshold ascending
                // and cumulative_amount must be non-decreasing
                for window in tranches.windows(2) {
                    let prev = &window[0];
                    let curr = &window[1];
                    require!(
                        prev.threshold < curr.threshold,
                        PerformancePackageError::InvalidTranches
                    );
                    require!(
                        prev.cumulative_amount <= curr.cumulative_amount,
                        PerformancePackageError::InvalidTranches
                    );
                }
            }
        }
        Ok(())
    }

    /// Calculates the cumulative rewards earned for a given oracle value.
    /// Returns total tokens deserved so far (cumulative, not incremental).
    pub fn calculate(&self, value: u128) -> Result<u64> {
        match self {
            &RewardFunction::CliffLinear {
                start_value,
                cliff_value,
                end_value,
                cliff_amount,
                total_amount,
            } => {
                // Before start: 0 rewards
                if value < start_value {
                    return Ok(0);
                }

                // Before cliff: 0 rewards
                if value < cliff_value {
                    return Ok(0);
                }

                // At or after end: full rewards
                if value >= end_value {
                    return Ok(total_amount);
                }

                // Between cliff and end: cliff_amount + linear_portion
                // linear_portion = (value - cliff_value) * (total_amount - cliff_amount) / (end_value - cliff_value)

                // Value progress is zero if value is less than cliff_value
                let value_progress = value.saturating_sub(cliff_value);
                let value_range = end_value - cliff_value;

                // If there's no linear range, it's only a cliff
                if value_range == 0 {
                    return Ok(cliff_amount);
                }

                let linear_amount = (total_amount - cliff_amount) as u128;

                // Calculate: cliff_amount + (value_progress * linear_amount / value_range)
                let linear_portion = u64::try_from(value_progress * linear_amount / value_range)
                    .map_err(|_| PerformancePackageError::RewardCalculationOverflow)?;

                let result = cliff_amount + linear_portion;

                Ok(result)
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
    /// Total tokens at this tranche (cumulative, not incremental)
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
    /// Token mint controlled by mint_governor
    pub mint: Pubkey,
    /// MintGovernor account
    pub mint_governor: Pubkey,
    /// MintAuthority PDA for this PP
    pub mint_authority: Pubkey,

    /// Usually the DAO multisig vault - can modify PP
    pub authority: Pubkey,
    /// Usually the team multisig - receives minted tokens
    pub recipient: Pubkey,

    /// Stores start/end snapshots for oracle calculations
    pub oracle_reader: OracleReader,
    /// How to calculate rewards
    pub reward_function: RewardFunction,

    /// Locked or Unlocking state
    pub status: PackageStatus,
    /// Can't start unlock before this time
    pub min_unlock_timestamp: i64,

    /// Cumulative tokens minted to the recipient
    pub total_rewards_paid_out: u64,
    /// Event sequence number
    pub seq_num: u64,

    /// Used for PDA derivation
    pub create_key: Pubkey,
    /// PDA bump
    pub bump: u8,
}
