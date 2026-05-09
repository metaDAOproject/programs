use crate::common::types::performance_package_v_2::OracleReader;
use crate::common::types::performance_package_v_2::PackageStatus;
use crate::common::types::performance_package_v_2::PerformancePackage;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

use trident_fuzz::invariant;
use trident_fuzz::invariant_eq;

impl FuzzTest {
    pub fn verify_start_unlock_invariants(
        &mut self,
        performance_package: Pubkey,
        signer: Pubkey,
        pre_pp: &PerformancePackage,
        timestamp_before_tx: i64,
    ) {
        let post_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist after StartUnlock");

        // Invariant 1: the signer must be the pre-state recipient.
        invariant_eq!(
            signer,
            pre_pp.recipient,
            "StartUnlock signer must equal PerformancePackage.recipient"
        );

        // Invariant 2: StartUnlock must transition status from Locked -> Unlocking.
        invariant!(
            matches!(pre_pp.status, PackageStatus::Locked),
            "Pre-state must be Locked if tx succeeded"
        );
        invariant!(
            matches!(post_pp.status, PackageStatus::Unlocking),
            "Post-state must be Unlocking after StartUnlock"
        );

        // Invariant 3: oracle_reader must either remain unchanged (Time) or update only its
        // start snapshot fields (FutarchyTwap).
        match (&pre_pp.oracleReader, &post_pp.oracleReader) {
            (OracleReader::Time, OracleReader::Time) => {}
            (
                OracleReader::FutarchyTwap {
                    amm: pre_amm,
                    minDuration: pre_min_duration,
                    startValue: _,
                    startTime: _,
                    endValue: pre_end_value,
                    endTime: pre_end_time,
                },
                OracleReader::FutarchyTwap {
                    amm: post_amm,
                    minDuration: post_min_duration,
                    startValue: _,
                    startTime: post_start_time,
                    endValue: post_end_value,
                    endTime: post_end_time,
                },
            ) => {
                invariant_eq!(
                    post_amm,
                    pre_amm,
                    "FutarchyTwap amm must not change on StartUnlock"
                );
                invariant_eq!(
                    post_min_duration,
                    pre_min_duration,
                    "FutarchyTwap minDuration must not change on StartUnlock"
                );
                invariant_eq!(
                    post_end_value,
                    pre_end_value,
                    "FutarchyTwap endValue must not change on StartUnlock"
                );
                invariant_eq!(
                    post_end_time,
                    pre_end_time,
                    "FutarchyTwap endTime must not change on StartUnlock"
                );
                invariant!(
                    *post_start_time >= timestamp_before_tx,
                    "FutarchyTwap startTime must be >= timestamp before tx"
                );
                invariant!(
                    *post_start_time <= self.trident.get_current_timestamp(),
                    "FutarchyTwap startTime must be <= current time after tx"
                );
            }
            _ => panic!("oracleReader variant must not change on StartUnlock"),
        }

        // Invariant 4: seqNum must increment by exactly 1.
        invariant_eq!(
            post_pp.seqNum,
            pre_pp
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "seqNum must increment by exactly 1 on StartUnlock"
        );

        // Invariant 5: the unlock time gate must have been satisfied if the instruction succeeded.
        let timestamp_after_tx = self.trident.get_current_timestamp();
        invariant!(
            timestamp_after_tx >= pre_pp.minUnlockTimestamp,
            "Clock must be >= minUnlockTimestamp if StartUnlock succeeded"
        );

        // Invariant 6: StartUnlock must not mutate unrelated fields.
        invariant_eq!(
            post_pp.mint,
            pre_pp.mint,
            "mint must not change on StartUnlock"
        );
        invariant_eq!(
            post_pp.mintGovernor,
            pre_pp.mintGovernor,
            "mintGovernor must not change on StartUnlock"
        );
        invariant_eq!(
            post_pp.mintAuthority,
            pre_pp.mintAuthority,
            "mintAuthority must not change on StartUnlock"
        );
        invariant_eq!(
            post_pp.authority,
            pre_pp.authority,
            "authority must not change on StartUnlock"
        );
        invariant_eq!(
            post_pp.recipient,
            pre_pp.recipient,
            "recipient must not change on StartUnlock"
        );
        invariant_eq!(
            post_pp.rewardFunction,
            pre_pp.rewardFunction,
            "rewardFunction must not change on StartUnlock"
        );
        invariant_eq!(
            post_pp.minUnlockTimestamp,
            pre_pp.minUnlockTimestamp,
            "minUnlockTimestamp must not change on StartUnlock"
        );
        invariant_eq!(
            post_pp.totalRewardsPaidOut,
            pre_pp.totalRewardsPaidOut,
            "totalRewardsPaidOut must not change on StartUnlock"
        );
        invariant_eq!(
            post_pp.createKey,
            pre_pp.createKey,
            "createKey must not change on StartUnlock"
        );
        invariant_eq!(
            post_pp.bump,
            pre_pp.bump,
            "bump must not change on StartUnlock"
        );
    }
}
