use crate::common::constants::CHANGE_REQUEST_SEED_PREFIX;
use crate::common::types::performance_package_v_2;
use crate::common::types::performance_package_v_2::ChangeRequest;
use crate::common::types::performance_package_v_2::PerformancePackage;
use crate::common::types::performance_package_v_2::ProposeChangeArgs;
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;

use trident_fuzz::invariant;
use trident_fuzz::invariant_eq;

impl FuzzTest {
    pub fn verify_propose_change_invariants(
        &mut self,
        change_request: Pubkey,
        performance_package: Pubkey,
        proposer: Pubkey,
        args: &ProposeChangeArgs,
        pre_pp: &PerformancePackage,
        timestamp_before_tx: i64,
    ) {
        let post_cr = self
            .trident
            .get_account_with_type::<ChangeRequest>(&change_request, Some(8))
            .expect("ChangeRequest must exist after ProposeChange");

        let post_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist after ProposeChange");

        // Invariant 1: `change_request` address must match PDA derivation from the program seeds.
        let (expected_pda, expected_bump) = self.trident.find_program_address(
            &[
                CHANGE_REQUEST_SEED_PREFIX,
                performance_package.as_ref(),
                proposer.as_ref(),
                args.pdaNonce.to_le_bytes().as_ref(),
            ],
            &performance_package_v_2::program_id(),
        );
        invariant_eq!(
            change_request, expected_pda,
            "ChangeRequest PDA must match seeds (change_request, performance_package, proposer, pda_nonce)"
        );
        invariant_eq!(
            post_cr.bump,
            expected_bump,
            "Stored bump must match PDA derivation bump"
        );

        // Invariant 2: change_request must point to the correct performance_package.
        invariant_eq!(
            post_cr.performancePackage,
            performance_package,
            "ChangeRequest.performancePackage must equal the provided performance_package"
        );

        // Invariant 4: pdaNonce must be stored exactly as provided.
        invariant_eq!(
            post_cr.pdaNonce,
            args.pdaNonce,
            "ChangeRequest.pdaNonce must equal args.pdaNonce"
        );

        // Invariant 5: all requested field updates must be stored exactly as proposed.
        invariant_eq!(
            post_cr.newRecipient,
            args.newRecipient,
            "ChangeRequest.newRecipient must equal args.newRecipient"
        );
        invariant_eq!(
            post_cr.newOracleReader,
            args.newOracleReader,
            "ChangeRequest.newOracleReader must equal args.newOracleReader"
        );
        invariant_eq!(
            post_cr.newRewardFunction,
            args.newRewardFunction,
            "ChangeRequest.newRewardFunction must equal args.newRewardFunction"
        );

        // Invariant 6: proposedAt must be within [timestamp_before_tx, now].
        let timestamp_after_tx = self.trident.get_current_timestamp();
        invariant!(
            post_cr.proposedAt >= timestamp_before_tx,
            "proposedAt must be >= timestamp before tx"
        );
        invariant!(
            post_cr.proposedAt <= timestamp_after_tx,
            "proposedAt must be <= timestamp after tx"
        );

        // Invariant 7: ProposeChange must not mutate PerformancePackage state except seqNum.
        invariant_eq!(
            post_pp.mint,
            pre_pp.mint,
            "PerformancePackage.mint must not change on ProposeChange"
        );
        invariant_eq!(
            post_pp.mintGovernor,
            pre_pp.mintGovernor,
            "PerformancePackage.mintGovernor must not change on ProposeChange"
        );
        invariant_eq!(
            post_pp.mintAuthority,
            pre_pp.mintAuthority,
            "PerformancePackage.mintAuthority must not change on ProposeChange"
        );
        invariant_eq!(
            post_pp.authority,
            pre_pp.authority,
            "PerformancePackage.authority must not change on ProposeChange"
        );
        invariant_eq!(
            post_pp.recipient,
            pre_pp.recipient,
            "PerformancePackage.recipient must not change on ProposeChange"
        );
        invariant_eq!(
            post_pp.oracleReader,
            pre_pp.oracleReader,
            "PerformancePackage.oracleReader must not change on ProposeChange"
        );
        invariant_eq!(
            post_pp.rewardFunction,
            pre_pp.rewardFunction,
            "PerformancePackage.rewardFunction must not change on ProposeChange"
        );
        invariant_eq!(
            post_pp.status,
            pre_pp.status,
            "PerformancePackage.status must not change on ProposeChange"
        );
        invariant_eq!(
            post_pp.minUnlockTimestamp,
            pre_pp.minUnlockTimestamp,
            "PerformancePackage.minUnlockTimestamp must not change on ProposeChange"
        );
        invariant_eq!(
            post_pp.totalRewardsPaidOut,
            pre_pp.totalRewardsPaidOut,
            "PerformancePackage.totalRewardsPaidOut must not change on ProposeChange"
        );
        invariant_eq!(
            post_pp.createKey,
            pre_pp.createKey,
            "PerformancePackage.createKey must not change on ProposeChange"
        );
        invariant_eq!(
            post_pp.bump,
            pre_pp.bump,
            "PerformancePackage.bump must not change on ProposeChange"
        );

        // Invariant 8: ProposeChange increments seqNum by exactly 1.
        invariant_eq!(
            post_pp.seqNum,
            pre_pp
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "PerformancePackage.seqNum must increment by exactly 1 on ProposeChange"
        );
    }
}
