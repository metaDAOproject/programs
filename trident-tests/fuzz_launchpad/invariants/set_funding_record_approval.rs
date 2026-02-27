use crate::common::types::launchpad_v_7::FundingRecord;
use crate::common::types::launchpad_v_7::Launch;
use crate::common::types::launchpad_v_7::LaunchState;
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;

impl FuzzTest {
    pub fn verify_set_funding_record_approval_invariants(
        &mut self,
        launch: Pubkey,
        funding_record: Pubkey,
        launch_authority: Pubkey,
        approved_amount: u64,
        pre_launch: &Launch,
        pre_funding_record: &FundingRecord,
    ) {
        let post_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist after SetFundingRecordApproval");
        let post_funding_record = self
            .trident
            .get_account_with_type::<FundingRecord>(&funding_record, Some(8))
            .expect("FundingRecord account must exist after SetFundingRecordApproval");

        // Invariant 1: Authority must match (has_one).
        assert_eq!(
            launch_authority, pre_launch.launchAuthority,
            "launch_authority must match Launch.launchAuthority"
        );

        // Invariant 2: Must be in Closed state if tx succeeded.
        assert!(
            matches!(pre_launch.state, LaunchState::Closed),
            "pre-state must be Closed if SetFundingRecordApproval succeeded"
        );
        assert!(
            matches!(post_launch.state, LaunchState::Closed),
            "state must remain Closed after SetFundingRecordApproval"
        );

        // Invariant 3: Close timestamp must exist and approval window must not be over.
        let closed_at = pre_launch
            .unixTimestampClosed
            .expect("unixTimestampClosed must be Some if SetFundingRecordApproval succeeded");
        let now = self.trident.get_current_timestamp();
        let two_days_after_close = closed_at.saturating_add(60 * 60 * 24 * 2);
        assert!(
            now <= two_days_after_close,
            "approval must occur within 2 days of unixTimestampClosed"
        );

        // Invariant 4: FundingRecord must belong to launch and approved_amount <= committedAmount.
        assert_eq!(
            pre_funding_record.launch, launch,
            "FundingRecord.launch must equal launch"
        );
        assert_eq!(
            post_funding_record.launch, launch,
            "FundingRecord.launch must remain launch"
        );
        assert!(
            approved_amount <= pre_funding_record.committedAmount,
            "approved_amount must be <= committedAmount if tx succeeded"
        );

        // Invariant 5: FundingRecord mutation must set approvedAmount and preserve other fields.
        assert_eq!(
            post_funding_record.approvedAmount, approved_amount,
            "FundingRecord.approvedAmount must equal the instruction input"
        );
        assert_eq!(
            post_funding_record.committedAmount, pre_funding_record.committedAmount,
            "FundingRecord.committedAmount must not change"
        );
        assert_eq!(
            post_funding_record.funder, pre_funding_record.funder,
            "FundingRecord.funder must not change"
        );
        assert_eq!(
            post_funding_record.isTokensClaimed, pre_funding_record.isTokensClaimed,
            "FundingRecord.isTokensClaimed must not change"
        );
        assert_eq!(
            post_funding_record.isUsdcRefunded, pre_funding_record.isUsdcRefunded,
            "FundingRecord.isUsdcRefunded must not change"
        );

        // Invariant 6: Launch mutation must adjust totalApprovedAmount by delta and increment seqNum by 1.
        let expected_total_approved = if approved_amount >= pre_funding_record.approvedAmount {
            pre_launch
                .totalApprovedAmount
                .checked_add(approved_amount - pre_funding_record.approvedAmount)
                .expect("totalApprovedAmount overflow should be impossible")
        } else {
            pre_launch
                .totalApprovedAmount
                .checked_sub(pre_funding_record.approvedAmount - approved_amount)
                .expect("totalApprovedAmount underflow should be impossible")
        };
        assert_eq!(
            post_launch.totalApprovedAmount, expected_total_approved,
            "Launch.totalApprovedAmount must change by exactly the delta of approvedAmount"
        );
        assert_eq!(
            post_launch.seqNum,
            pre_launch
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "Launch.seqNum must increment by exactly 1"
        );

        // Invariant 7: Unrelated launch fields must not change.
        assert_eq!(
            post_launch.minimumRaiseAmount, pre_launch.minimumRaiseAmount,
            "minimumRaiseAmount must not change"
        );
        assert_eq!(
            post_launch.monthlySpendingLimitAmount, pre_launch.monthlySpendingLimitAmount,
            "monthlySpendingLimitAmount must not change"
        );
        assert_eq!(
            post_launch.monthlySpendingLimitMembers, pre_launch.monthlySpendingLimitMembers,
            "monthlySpendingLimitMembers must not change"
        );
        assert_eq!(
            post_launch.launchAuthority, pre_launch.launchAuthority,
            "launchAuthority must not change"
        );
        assert_eq!(
            post_launch.launchSigner, pre_launch.launchSigner,
            "launchSigner must not change"
        );
        assert_eq!(
            post_launch.launchSignerPdaBump, pre_launch.launchSignerPdaBump,
            "launchSignerPdaBump must not change"
        );
        assert_eq!(
            post_launch.launchQuoteVault, pre_launch.launchQuoteVault,
            "launchQuoteVault must not change"
        );
        assert_eq!(
            post_launch.launchBaseVault, pre_launch.launchBaseVault,
            "launchBaseVault must not change"
        );
        assert_eq!(
            post_launch.baseMint, pre_launch.baseMint,
            "baseMint must not change"
        );
        assert_eq!(
            post_launch.quoteMint, pre_launch.quoteMint,
            "quoteMint must not change"
        );
        assert_eq!(
            post_launch.unixTimestampStarted, pre_launch.unixTimestampStarted,
            "unixTimestampStarted must not change"
        );
        assert_eq!(
            post_launch.unixTimestampClosed, pre_launch.unixTimestampClosed,
            "unixTimestampClosed must not change"
        );
        assert_eq!(
            post_launch.totalCommittedAmount, pre_launch.totalCommittedAmount,
            "totalCommittedAmount must not change"
        );
        assert_eq!(
            post_launch.secondsForLaunch, pre_launch.secondsForLaunch,
            "secondsForLaunch must not change"
        );
        assert_eq!(post_launch.dao, pre_launch.dao, "dao must not change");
        assert_eq!(
            post_launch.daoVault, pre_launch.daoVault,
            "daoVault must not change"
        );
        assert_eq!(
            post_launch.performancePackageGrantee, pre_launch.performancePackageGrantee,
            "performancePackageGrantee must not change"
        );
        assert_eq!(
            post_launch.performancePackageTokenAmount, pre_launch.performancePackageTokenAmount,
            "performancePackageTokenAmount must not change"
        );
        assert_eq!(
            post_launch.monthsUntilInsidersCanUnlock, pre_launch.monthsUntilInsidersCanUnlock,
            "monthsUntilInsidersCanUnlock must not change"
        );
        assert_eq!(
            post_launch.teamAddress, pre_launch.teamAddress,
            "teamAddress must not change"
        );
        assert_eq!(
            post_launch.additionalTokensAmount, pre_launch.additionalTokensAmount,
            "additionalTokensAmount must not change"
        );
        assert_eq!(
            post_launch.additionalTokensRecipient, pre_launch.additionalTokensRecipient,
            "additionalTokensRecipient must not change"
        );
        assert_eq!(
            post_launch.additionalTokensClaimed, pre_launch.additionalTokensClaimed,
            "additionalTokensClaimed must not change"
        );
        assert_eq!(
            post_launch.unixTimestampCompleted, pre_launch.unixTimestampCompleted,
            "unixTimestampCompleted must not change"
        );
        assert_eq!(
            post_launch.isPerformancePackageInitialized, pre_launch.isPerformancePackageInitialized,
            "isPerformancePackageInitialized must not change"
        );
    }
}
