use crate::common::types::launchpad_v_7::Launch;
use crate::common::types::launchpad_v_7::LaunchState;
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;
use trident_fuzz::invariant;
use trident_fuzz::invariant_eq;

impl FuzzTest {
    pub fn verify_close_launch_invariants(
        &mut self,
        launch: Pubkey,
        pre_launch: &Launch,
        timestamp_before_tx: i64,
    ) {
        let post_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist after CloseLaunch");

        // Invariant 1: Must be Live pre-state if tx succeeded.
        invariant!(
            matches!(pre_launch.state, LaunchState::Live),
            "pre-state must be Live if CloseLaunch succeeded"
        );

        // Invariant 2: Launch period must be over if tx succeeded.
        let started = pre_launch
            .unixTimestampStarted
            .expect("unixTimestampStarted must be Some if CloseLaunch succeeded");
        let period_end = started.saturating_add(pre_launch.secondsForLaunch as i64);
        let timestamp_after_tx = self.trident.get_current_timestamp();
        invariant!(
            timestamp_before_tx >= period_end,
            "CloseLaunch must occur after launch period end (timestamp_before_tx)"
        );
        invariant!(
            timestamp_after_tx >= period_end,
            "CloseLaunch must occur after launch period end (timestamp_after_tx)"
        );

        // Invariant 3: State transition depends on whether minimum raise was met.
        let expected_state = if pre_launch.minimumRaiseAmount > pre_launch.totalCommittedAmount {
            LaunchState::Refunding
        } else {
            LaunchState::Closed
        };
        match (&post_launch.state, expected_state) {
            (LaunchState::Refunding, LaunchState::Refunding)
            | (LaunchState::Closed, LaunchState::Closed) => {}
            _ => panic!("post-state must be Refunding or Closed as determined by pre-state totals"),
        }

        // Invariant 4: unixTimestampClosed must be set within [timestamp_before_tx, timestamp_after_tx].
        let closed = post_launch
            .unixTimestampClosed
            .expect("unixTimestampClosed must be Some after CloseLaunch");
        invariant!(
            closed >= timestamp_before_tx,
            "unixTimestampClosed must be >= timestamp_before_tx"
        );
        invariant!(
            closed <= timestamp_after_tx,
            "unixTimestampClosed must be <= timestamp_after_tx"
        );

        // Invariant 5: seqNum must increment by exactly 1.
        invariant_eq!(
            post_launch.seqNum,
            pre_launch
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "seqNum must increment by exactly 1 on CloseLaunch"
        );

        // Invariant 6: Unrelated fields must not change.
        invariant_eq!(
            post_launch.pdaBump,
            pre_launch.pdaBump,
            "pdaBump must not change"
        );
        invariant_eq!(
            post_launch.minimumRaiseAmount,
            pre_launch.minimumRaiseAmount,
            "minimumRaiseAmount must not change"
        );
        invariant_eq!(
            post_launch.monthlySpendingLimitAmount,
            pre_launch.monthlySpendingLimitAmount,
            "monthlySpendingLimitAmount must not change"
        );
        invariant_eq!(
            post_launch.monthlySpendingLimitMembers,
            pre_launch.monthlySpendingLimitMembers,
            "monthlySpendingLimitMembers must not change"
        );
        invariant_eq!(
            post_launch.launchAuthority,
            pre_launch.launchAuthority,
            "launchAuthority must not change"
        );
        invariant_eq!(
            post_launch.launchSigner,
            pre_launch.launchSigner,
            "launchSigner must not change"
        );
        invariant_eq!(
            post_launch.launchSignerPdaBump,
            pre_launch.launchSignerPdaBump,
            "launchSignerPdaBump must not change"
        );
        invariant_eq!(
            post_launch.launchQuoteVault,
            pre_launch.launchQuoteVault,
            "launchQuoteVault must not change"
        );
        invariant_eq!(
            post_launch.launchBaseVault,
            pre_launch.launchBaseVault,
            "launchBaseVault must not change"
        );
        invariant_eq!(
            post_launch.baseMint,
            pre_launch.baseMint,
            "baseMint must not change"
        );
        invariant_eq!(
            post_launch.quoteMint,
            pre_launch.quoteMint,
            "quoteMint must not change"
        );
        invariant_eq!(
            post_launch.unixTimestampStarted,
            pre_launch.unixTimestampStarted,
            "unixTimestampStarted must not change"
        );
        invariant_eq!(
            post_launch.totalCommittedAmount,
            pre_launch.totalCommittedAmount,
            "totalCommittedAmount must not change"
        );
        invariant_eq!(
            post_launch.totalApprovedAmount,
            pre_launch.totalApprovedAmount,
            "totalApprovedAmount must not change"
        );
        invariant_eq!(
            post_launch.secondsForLaunch,
            pre_launch.secondsForLaunch,
            "secondsForLaunch must not change"
        );
        invariant_eq!(post_launch.dao, pre_launch.dao, "dao must not change");
        invariant_eq!(
            post_launch.daoVault,
            pre_launch.daoVault,
            "daoVault must not change"
        );
        invariant_eq!(
            post_launch.performancePackageGrantee,
            pre_launch.performancePackageGrantee,
            "performancePackageGrantee must not change"
        );
        invariant_eq!(
            post_launch.performancePackageTokenAmount,
            pre_launch.performancePackageTokenAmount,
            "performancePackageTokenAmount must not change"
        );
        invariant_eq!(
            post_launch.monthsUntilInsidersCanUnlock,
            pre_launch.monthsUntilInsidersCanUnlock,
            "monthsUntilInsidersCanUnlock must not change"
        );
        invariant_eq!(
            post_launch.teamAddress,
            pre_launch.teamAddress,
            "teamAddress must not change"
        );
        invariant_eq!(
            post_launch.additionalTokensAmount,
            pre_launch.additionalTokensAmount,
            "additionalTokensAmount must not change"
        );
        invariant_eq!(
            post_launch.additionalTokensRecipient,
            pre_launch.additionalTokensRecipient,
            "additionalTokensRecipient must not change"
        );
        invariant_eq!(
            post_launch.additionalTokensClaimed,
            pre_launch.additionalTokensClaimed,
            "additionalTokensClaimed must not change"
        );
        invariant_eq!(
            post_launch.unixTimestampCompleted,
            pre_launch.unixTimestampCompleted,
            "unixTimestampCompleted must not change"
        );
        invariant_eq!(
            post_launch.isPerformancePackageInitialized,
            pre_launch.isPerformancePackageInitialized,
            "isPerformancePackageInitialized must not change"
        );
    }
}
