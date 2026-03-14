use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

use crate::common::token::initialize_associated_token_account;
use crate::common::token::initialize_mint;
use crate::common::types::performance_package_v_2::InitializePerformancePackageArgs;
use crate::common::types::performance_package_v_2::OracleReader;
use crate::common::types::performance_package_v_2::RewardFunction;
use crate::common::types::performance_package_v_2::ThresholdTranche;
pub mod ppv2;

const MAX_TRANCHES: usize = 10;
const MAX_MIN_DURATION_SECONDS: u32 = 60 * 60 * 24 * 365;
const ONE_HOUR_SECONDS: i64 = 60 * 60;

impl FuzzTest {
    pub fn initial_setup(&mut self) {
        self.trident
            .airdrop(&self.payer.pubkey(), 500 * LAMPORTS_PER_SOL);
    }

    pub fn setup_mint(&mut self) -> Pubkey {
        let mint = self.trident.random_keypair();
        initialize_mint(
            &mut self.trident,
            self.payer.pubkey(),
            mint.pubkey(),
            6,
            self.payer.pubkey(),
            None,
            None,
        );
        mint.pubkey()
    }

    pub fn setup_recipient_token_account(&mut self, token_mint: Pubkey, recipient: Pubkey) -> Pubkey {
        initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            token_mint,
            recipient,
        )
    }

    pub fn random_initialize_performance_package_args(
        &mut self,
        current_timestamp: i64,
        futarchy_amm: Pubkey,
    ) -> InitializePerformancePackageArgs {
        // 99% valid, 1% invalid
        let mostly_valid = self.trident.random_from_range(1u8..=100u8) != 1;

        // PPV2 initialize does not require min_unlock_timestamp to be in the future. Keep it near
        // "now" so later flows can easily satisfy StartUnlock by advancing time slightly.
        let min_unlock_timestamp = if mostly_valid {
            current_timestamp + self.trident.random_from_range(0i64..=ONE_HOUR_SECONDS)
        } else {
            match self.trident.random_from_range(0u8..=1u8) {
                0 => current_timestamp.saturating_sub(ONE_HOUR_SECONDS),
                _ => current_timestamp.saturating_add(ONE_HOUR_SECONDS * 24),
            }
        };

        let oracle_reader = if self.trident.random_from_range(0u8..=1u8) == 0 {
            OracleReader::Time
        } else {
            let min_duration = if mostly_valid {
                self.trident
                    .random_from_range(1u32..=MAX_MIN_DURATION_SECONDS)
            } else {
                match self.trident.random_from_range(0u8..=2u8) {
                    0 => 0,
                    1 => MAX_MIN_DURATION_SECONDS.saturating_add(1),
                    _ => u32::MAX,
                }
            };
            OracleReader::FutarchyTwap {
                amm: futarchy_amm,
                minDuration: min_duration,
                startValue: 0,
                startTime: 0,
                endValue: 0,
                endTime: 0,
            }
        };

        let reward_function = match self.trident.random_from_range(0u8..=1u8) {
            0 => {
                let start_value = self.trident.random_from_range(0u64..=1_000_000) as u128;
                let cliff_value = start_value
                    .saturating_add(self.trident.random_from_range(0u64..=1_000_000) as u128);
                let end_value = if mostly_valid {
                    cliff_value.saturating_add(
                        self.trident.random_from_range(0u64..=1_000_000) as u128,
                    )
                } else {
                    start_value.saturating_sub(1)
                };
                let total_amount = self.trident.random_from_range(1u64..=10_000_000u64);
                let cliff_amount = if mostly_valid {
                    self.trident.random_from_range(0u64..=total_amount)
                } else {
                    total_amount.saturating_add(1)
                };

                RewardFunction::CliffLinear {
                    startValue: start_value,
                    cliffValue: cliff_value,
                    endValue: end_value,
                    cliffAmount: cliff_amount,
                    totalAmount: total_amount,
                }
            }
            _ => {
                let tranche_count: usize = if mostly_valid {
                    self.trident.random_from_range(1u32..=MAX_TRANCHES as u32) as usize
                } else {
                    match self.trident.random_from_range(0u8..=2u8) {
                        0 => 0,
                        1 => MAX_TRANCHES + 1 + self.trident.random_from_range(0u32..=5u32) as usize,
                        _ => self.trident.random_from_range(1u32..=MAX_TRANCHES as u32) as usize,
                    }
                };

                let mut tranches = Vec::with_capacity(tranche_count);
                let mut threshold: u128 = 0;
                let mut cumulative_amount: u64 = 0;
                for i in 0..tranche_count {
                    threshold = if mostly_valid || i == 0 {
                        threshold
                            .saturating_add(self.trident.random_from_range(0u64..=1_000_000) as u128)
                            .saturating_add(1)
                    } else {
                        threshold.saturating_sub(1)
                    };

                    cumulative_amount = if mostly_valid || i == 0 {
                        cumulative_amount
                            .saturating_add(self.trident.random_from_range(1u64..=10_000_000u64))
                    } else {
                        cumulative_amount.saturating_sub(1)
                    };

                    tranches.push(ThresholdTranche::new(threshold, cumulative_amount));
                }

                RewardFunction::Threshold { tranches }
            }
        };

        InitializePerformancePackageArgs::new(
            oracle_reader,
            reward_function,
            min_unlock_timestamp,
        )
    }
}
