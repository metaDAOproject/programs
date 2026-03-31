#![allow(clippy::too_many_arguments)]

use crate::common::constants::PERFORMANCE_PACKAGE_SEED_PREFIX;
use crate::common::types::performance_package_v_2;
use crate::common::types::performance_package_v_2::InitializePerformancePackageArgs;
use crate::common::types::performance_package_v_2::OracleReader;
use crate::common::types::performance_package_v_2::PackageStatus;
use crate::common::types::performance_package_v_2::PerformancePackage;
use crate::common::types::performance_package_v_2::RewardFunction;
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;

use trident_fuzz::invariant;
use trident_fuzz::invariant_eq;

const MAX_TRANCHES: usize = 10;
const MAX_MIN_DURATION_SECONDS: u32 = 60 * 60 * 24 * 365;

impl FuzzTest {
    pub fn verify_initialize_performance_package_invariants(
        &mut self,
        performance_package: Pubkey,
        create_key: Pubkey,
        token_mint: Pubkey,
        mint_governor: Pubkey,
        mint_authority: Pubkey,
        authority: Pubkey,
        recipient: Pubkey,
        args: &InitializePerformancePackageArgs,
    ) {
        let pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage account must exist after initialization");

        // Invariant 1: the performance_package PDA and stored PDA metadata must match the
        // program's derivation scheme.
        let (expected_pda, expected_bump) = self.trident.find_program_address(
            &[PERFORMANCE_PACKAGE_SEED_PREFIX, create_key.as_ref()],
            &performance_package_v_2::program_id(),
        );
        invariant_eq!(
            performance_package,
            expected_pda,
            "PerformancePackage PDA must match seeds (performance_package, create_key)"
        );
        invariant_eq!(
            pp.createKey,
            create_key,
            "Stored createKey must match the signer used to derive the PDA"
        );
        invariant_eq!(
            pp.bump,
            expected_bump,
            "Stored bump must match PDA derivation bump"
        );

        // Invariant 2: all account identity fields persisted into PerformancePackage must match
        // the instruction accounts used during initialization.
        invariant_eq!(
            pp.mint,
            token_mint,
            "Stored mint must match the mint account"
        );
        invariant_eq!(
            pp.mintGovernor,
            mint_governor,
            "Stored mintGovernor must match the mint_governor account"
        );
        invariant_eq!(
            pp.mintAuthority,
            mint_authority,
            "Stored mintAuthority must match the mint_authority account"
        );
        invariant_eq!(
            pp.authority,
            authority,
            "Stored authority must match the authority account"
        );
        invariant_eq!(
            pp.recipient,
            recipient,
            "Stored recipient must match the recipient account"
        );

        // Invariant 3: all config fields persisted into PerformancePackage must match the
        // initialization args exactly.
        invariant_eq!(
            pp.oracleReader,
            args.oracleReader,
            "Stored oracleReader must match args.oracleReader"
        );
        invariant_eq!(
            pp.rewardFunction,
            args.rewardFunction,
            "Stored rewardFunction must match args.rewardFunction"
        );
        invariant_eq!(
            pp.minUnlockTimestamp,
            args.minUnlockTimestamp,
            "Stored minUnlockTimestamp must match args.minUnlockTimestamp"
        );

        // Invariant 4: initialization must set the expected starting lifecycle/bookkeeping state.
        invariant!(
            matches!(pp.status, PackageStatus::Locked),
            "PerformancePackage status must start as Locked"
        );
        invariant_eq!(
            pp.totalRewardsPaidOut,
            0,
            "totalRewardsPaidOut must start at 0"
        );
        invariant_eq!(pp.seqNum, 0, "seqNum must start at 0 on initialization");

        // Invariant 5: oracleReader must remain internally valid after storage.
        match (&pp.oracleReader, &args.oracleReader) {
            (OracleReader::Time, OracleReader::Time) => {}
            (
                OracleReader::FutarchyTwap {
                    amm,
                    minDuration,
                    startValue,
                    startTime,
                    endValue,
                    endTime,
                },
                OracleReader::FutarchyTwap {
                    amm: expected_amm,
                    minDuration: expected_min_duration,
                    startValue: expected_start_value,
                    startTime: expected_start_time,
                    endValue: expected_end_value,
                    endTime: expected_end_time,
                },
            ) => {
                invariant_eq!(
                    *amm,
                    *expected_amm,
                    "Stored FutarchyTwap amm must match args"
                );
                invariant_eq!(
                    *minDuration,
                    *expected_min_duration,
                    "Stored FutarchyTwap minDuration must match args"
                );
                invariant_eq!(
                    *startValue,
                    *expected_start_value,
                    "Stored FutarchyTwap startValue must match args"
                );
                invariant_eq!(
                    *startTime,
                    *expected_start_time,
                    "Stored FutarchyTwap startTime must match args"
                );
                invariant_eq!(
                    *endValue,
                    *expected_end_value,
                    "Stored FutarchyTwap endValue must match args"
                );
                invariant_eq!(
                    *endTime,
                    *expected_end_time,
                    "Stored FutarchyTwap endTime must match args"
                );
                invariant!(
                    *minDuration > 0,
                    "FutarchyTwap minDuration must be > 0 after successful initialization"
                );
                invariant!(
                    *minDuration <= MAX_MIN_DURATION_SECONDS,
                    "FutarchyTwap minDuration must be <= MAX_MIN_DURATION"
                );
            }
            _ => panic!("Stored oracleReader variant must match args.oracleReader"),
        }

        // Invariant 6: rewardFunction must remain internally valid after storage.
        match (&pp.rewardFunction, &args.rewardFunction) {
            (
                RewardFunction::CliffLinear {
                    startValue,
                    cliffValue,
                    endValue,
                    cliffAmount,
                    totalAmount,
                },
                RewardFunction::CliffLinear { .. },
            ) => {
                invariant!(
                    startValue <= cliffValue && cliffValue <= endValue,
                    "CliffLinear must satisfy startValue <= cliffValue <= endValue"
                );
                invariant!(
                    cliffAmount <= totalAmount,
                    "CliffLinear must satisfy cliffAmount <= totalAmount"
                );
            }
            (RewardFunction::Threshold { tranches }, RewardFunction::Threshold { .. }) => {
                invariant!(
                    !tranches.is_empty(),
                    "Threshold reward function must have at least one tranche"
                );
                invariant!(
                    tranches.len() <= MAX_TRANCHES,
                    "Threshold reward function must not exceed MAX_TRANCHES"
                );
                for window in tranches.windows(2) {
                    let prev = &window[0];
                    let curr = &window[1];
                    invariant!(
                        prev.threshold < curr.threshold,
                        "Threshold tranches must be sorted by strictly increasing threshold"
                    );
                    invariant!(
                        prev.cumulativeAmount <= curr.cumulativeAmount,
                        "Threshold tranches must have non-decreasing cumulativeAmount"
                    );
                }
            }
            _ => panic!("Stored rewardFunction variant must match args.rewardFunction"),
        }
    }
}
