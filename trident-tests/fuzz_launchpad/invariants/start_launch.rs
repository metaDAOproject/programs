use crate::common::types::launchpad_v_7::Launch;
use crate::common::types::launchpad_v_7::LaunchState;
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;

impl FuzzTest {
    pub fn verify_start_launch_invariants(
        &mut self,
        launch: Pubkey,
        launch_authority: Pubkey,
        pre_launch: &Launch,
        timestamp_before_tx: i64,
    ) {
        let post_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist after StartLaunch");

        // Invariant 1: Authority must match (has_one).
        assert_eq!(
            launch_authority, pre_launch.launchAuthority,
            "launch_authority must match Launch.launchAuthority"
        );

        // Invariant 2: State transition must be Initialized -> Live.
        assert!(
            matches!(pre_launch.state, LaunchState::Initialized),
            "pre-state must be Initialized if StartLaunch succeeded"
        );
        assert!(
            matches!(post_launch.state, LaunchState::Live),
            "post-state must be Live after StartLaunch"
        );

        // Invariant 3: unixTimestampStarted must be set within [timestamp_before_tx, timestamp_after_tx].
        let timestamp_after_tx = self.trident.get_current_timestamp();
        let started = post_launch
            .unixTimestampStarted
            .expect("unixTimestampStarted must be Some after StartLaunch");
        assert!(
            started >= timestamp_before_tx,
            "unixTimestampStarted must be >= timestamp_before_tx"
        );
        assert!(
            started <= timestamp_after_tx,
            "unixTimestampStarted must be <= timestamp_after_tx"
        );

        // Invariant 4: seqNum must increment by exactly 1.
        assert_eq!(
            post_launch.seqNum,
            pre_launch
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "seqNum must increment by exactly 1 on StartLaunch"
        );

        // Invariant 5: Unrelated fields must not change.
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
            post_launch.unixTimestampClosed, pre_launch.unixTimestampClosed,
            "unixTimestampClosed must not change"
        );
        assert_eq!(
            post_launch.totalCommittedAmount, pre_launch.totalCommittedAmount,
            "totalCommittedAmount must not change"
        );
        assert_eq!(
            post_launch.totalApprovedAmount, pre_launch.totalApprovedAmount,
            "totalApprovedAmount must not change"
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
