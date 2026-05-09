use crate::common::types::performance_package_v_2::ChangeRequest;
use crate::common::types::performance_package_v_2::PackageStatus;
use crate::common::types::performance_package_v_2::PerformancePackage;
use crate::FuzzTest;

use trident_fuzz::fuzzing::Pubkey;
use trident_fuzz::invariant;
use trident_fuzz::invariant_eq;

impl FuzzTest {
    pub fn verify_execute_change_invariants(
        &mut self,
        change_request: Pubkey,
        performance_package: Pubkey,
        executor: Pubkey,
        pre_pp: &PerformancePackage,
        pre_cr: &ChangeRequest,
    ) {
        let post_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist after ExecuteChange");

        // Invariant 1: executor must be the opposite party of the proposerType stored in
        // ChangeRequest.
        if pre_cr.proposer == pre_pp.authority {
            invariant_eq!(
                executor,
                pre_pp.recipient,
                "If authority proposed, recipient must execute"
            );
        } else if pre_cr.proposer == pre_pp.recipient {
            invariant_eq!(
                executor,
                pre_pp.authority,
                "If recipient proposed, authority must execute"
            );
        } else {
            invariant!(false, "Invalid proposer");
        }

        // Invariant 2: change_request must belong to the supplied performance_package.
        invariant_eq!(
            pre_cr.performancePackage,
            performance_package,
            "ChangeRequest.performancePackage must match the executed performance_package"
        );

        // Invariant 3: oracle/reward changes can only execute from the Locked state.
        if pre_cr.newOracleReader.is_some() || pre_cr.newRewardFunction.is_some() {
            invariant!(
                matches!(pre_pp.status, PackageStatus::Locked),
                "Oracle/reward changes can only execute when the package was Locked"
            );
        }

        // Invariant 4: seqNum must increment by exactly 1.
        invariant_eq!(
            post_pp.seqNum,
            pre_pp
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "PerformancePackage.seqNum must increment by exactly 1 on ExecuteChange"
        );

        // Invariant 5: ExecuteChange must apply each optional field exactly when present, and
        // otherwise leave the field unchanged.
        if let Some(new_recipient) = pre_cr.newRecipient {
            invariant_eq!(
                post_pp.recipient,
                new_recipient,
                "ExecuteChange must update recipient to change_request.newRecipient"
            );
        } else {
            invariant_eq!(
                post_pp.recipient,
                pre_pp.recipient,
                "ExecuteChange must not change recipient when newRecipient is None"
            );
        }

        if let Some(ref new_oracle_reader) = pre_cr.newOracleReader {
            invariant_eq!(
                &post_pp.oracleReader,
                new_oracle_reader,
                "ExecuteChange must update oracleReader to change_request.newOracleReader"
            );
        } else {
            invariant_eq!(
                post_pp.oracleReader,
                pre_pp.oracleReader,
                "ExecuteChange must not change oracleReader when newOracleReader is None"
            );
        }

        if let Some(ref new_reward_function) = pre_cr.newRewardFunction {
            invariant_eq!(
                &post_pp.rewardFunction,
                new_reward_function,
                "ExecuteChange must update rewardFunction to change_request.newRewardFunction"
            );
        } else {
            invariant_eq!(
                post_pp.rewardFunction,
                pre_pp.rewardFunction,
                "ExecuteChange must not change rewardFunction when newRewardFunction is None"
            );
        }

        // Invariant 6: ExecuteChange must not change unrelated fields.
        invariant_eq!(
            post_pp.mint,
            pre_pp.mint,
            "ExecuteChange must not change mint"
        );
        invariant_eq!(
            post_pp.mintGovernor,
            pre_pp.mintGovernor,
            "ExecuteChange must not change mintGovernor"
        );
        invariant_eq!(
            post_pp.mintAuthority,
            pre_pp.mintAuthority,
            "ExecuteChange must not change mintAuthority"
        );
        invariant_eq!(
            post_pp.authority,
            pre_pp.authority,
            "ExecuteChange must not change authority"
        );
        invariant_eq!(
            post_pp.status,
            pre_pp.status,
            "ExecuteChange must not change status"
        );
        invariant_eq!(
            post_pp.minUnlockTimestamp,
            pre_pp.minUnlockTimestamp,
            "ExecuteChange must not change minUnlockTimestamp"
        );
        invariant_eq!(
            post_pp.totalRewardsPaidOut,
            pre_pp.totalRewardsPaidOut,
            "ExecuteChange must not change totalRewardsPaidOut"
        );
        invariant_eq!(
            post_pp.createKey,
            pre_pp.createKey,
            "ExecuteChange must not change createKey"
        );
        invariant_eq!(
            post_pp.bump,
            pre_pp.bump,
            "ExecuteChange must not change bump"
        );

        // Invariant 7: the ChangeRequest account must be closed after ExecuteChange.
        let cr_after = self
            .trident
            .get_account_with_type::<ChangeRequest>(&change_request, Some(8));
        invariant!(
            cr_after.is_none(),
            "ChangeRequest must be closed (not readable) after ExecuteChange"
        );
    }
}
