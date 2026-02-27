use crate::common::types::price_based_performance_package::ChangeRequest;
use crate::common::types::price_based_performance_package::ChangeType;
use crate::common::types::price_based_performance_package::PerformancePackage;
use crate::common::types::price_based_performance_package::ProposerType;
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;

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

        // Invariant 1: executor must be the opposite party of the proposerType stored in ChangeRequest.
        match pre_cr.proposerType {
            ProposerType::Recipient => {
                assert_eq!(
                    executor, pre_pp.performancePackageAuthority,
                    "If recipient proposed, authority must execute"
                );
            }
            ProposerType::Authority => {
                assert_eq!(
                    executor, pre_pp.recipient,
                    "If authority proposed, recipient must execute"
                );
            }
        }

        // Invariant 2: seqNum must increment by exactly 1.
        assert_eq!(
            post_pp.seqNum,
            pre_pp
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "PerformancePackage.seqNum must increment by exactly 1 on ExecuteChange"
        );

        // Invariant 3: the change must be applied exactly as specified in ChangeRequest.changeType
        // and no other changeable field may be modified (besides seqNum).
        match &pre_cr.changeType {
            ChangeType::Oracle { newOracleConfig } => {
                assert_eq!(
                    post_pp.oracleConfig.oracleAccount, newOracleConfig.oracleAccount,
                    "ExecuteChange(Oracle) must update oracleConfig.oracleAccount"
                );
                assert_eq!(
                    post_pp.oracleConfig.byteOffset, newOracleConfig.byteOffset,
                    "ExecuteChange(Oracle) must update oracleConfig.byteOffset"
                );
                assert_eq!(
                    post_pp.recipient, pre_pp.recipient,
                    "ExecuteChange(Oracle) must not change recipient"
                );
            }
            ChangeType::Recipient { newRecipient } => {
                assert_eq!(
                    post_pp.recipient, *newRecipient,
                    "ExecuteChange(Recipient) must update recipient"
                );
                assert_eq!(
                    post_pp.oracleConfig.oracleAccount, pre_pp.oracleConfig.oracleAccount,
                    "ExecuteChange(Recipient) must not change oracleConfig.oracleAccount"
                );
                assert_eq!(
                    post_pp.oracleConfig.byteOffset, pre_pp.oracleConfig.byteOffset,
                    "ExecuteChange(Recipient) must not change oracleConfig.byteOffset"
                );
            }
        }

        // Invariant 4: performancePackageAuthority must not change on ExecuteChange.
        assert_eq!(
            post_pp.performancePackageAuthority, pre_pp.performancePackageAuthority,
            "ExecuteChange must not change performancePackageAuthority"
        );

        // Invariant 5: the ChangeRequest account must be closed after ExecuteChange (close = executor).
        // We treat non-existence as success here (Anchor close sets account to uninitialized).
        let cr_after = self
            .trident
            .get_account_with_type::<ChangeRequest>(&change_request, Some(8));
        assert!(
            cr_after.is_none(),
            "ChangeRequest must be closed (not readable) after ExecuteChange"
        );
    }
}
