#![allow(clippy::too_many_arguments)]

use crate::common::types::launchpad_v_7::Launch;
use crate::common::types::launchpad_v_7::LaunchState;
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;

// Keep in sync with `programs/v07_launchpad/src/lib.rs`.
const TOKEN_SCALE: u64 = 1_000_000;
const TOKENS_TO_PARTICIPANTS: u64 = 10_000_000 * TOKEN_SCALE;

impl FuzzTest {
    pub fn verify_complete_launch_invariants(
        &mut self,
        launch: Pubkey,
        launch_authority: Pubkey,
        dao: Pubkey,
        squads_multisig_vault: Pubkey,
        launch_quote_vault: Pubkey,
        launch_base_vault: Pubkey,
        treasury_quote_account: Pubkey,
        bid_wall_quote_token_account: Pubkey,
        pre_launch: &Launch,
        pre_launch_quote_amount: u64,
        pre_launch_base_amount: u64,
        pre_treasury_quote_amount: u64,
        pre_bid_wall_quote_amount: u64,
        timestamp_before_tx: i64,
    ) {
        let post_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist after CompleteLaunch");

        // Invariant 1: Validate requires Closed pre-state if tx succeeded.
        assert!(
            matches!(pre_launch.state, LaunchState::Closed),
            "pre-state must be Closed if CompleteLaunch succeeded"
        );

        // Invariant 2: If within the 2-day authority window, the authority must match.
        let timestamp_after_tx = self.trident.get_current_timestamp();
        if let Some(closed_at) = pre_launch.unixTimestampClosed {
            let two_days_after_close = closed_at.saturating_add(60 * 60 * 24 * 2);
            if two_days_after_close > timestamp_after_tx {
                assert_eq!(
                    launch_authority, pre_launch.launchAuthority,
                    "launch_authority must match Launch.launchAuthority during authority-only window"
                );
            }
        }

        // Invariant 3: Early-return branch when totalApprovedAmount < minimumRaiseAmount.
        if pre_launch.totalApprovedAmount < pre_launch.minimumRaiseAmount {
            assert!(
                matches!(post_launch.state, LaunchState::Refunding),
                "post-state must be Refunding when approvals < minimum_raise_amount"
            );
            assert_eq!(
                post_launch.seqNum,
                pre_launch
                    .seqNum
                    .checked_add(1)
                    .expect("seqNum overflow should be impossible"),
                "seqNum must increment by exactly 1"
            );
            assert_eq!(
                post_launch.dao, pre_launch.dao,
                "dao must not be set in early-refund branch"
            );
            assert_eq!(
                post_launch.daoVault, pre_launch.daoVault,
                "daoVault must not be set in early-refund branch"
            );
            assert_eq!(
                post_launch.unixTimestampCompleted, pre_launch.unixTimestampCompleted,
                "unixTimestampCompleted must not be set in early-refund branch"
            );

            let post_launch_quote_amount = self
                .trident
                .get_token_account(launch_quote_vault)
                .expect("launch_quote_vault must exist")
                .account
                .amount;
            let post_launch_base_amount = self
                .trident
                .get_token_account(launch_base_vault)
                .expect("launch_base_vault must exist")
                .account
                .amount;
            assert_eq!(
                post_launch_quote_amount, pre_launch_quote_amount,
                "launch_quote_vault must not change in early-refund branch"
            );
            assert_eq!(
                post_launch_base_amount, pre_launch_base_amount,
                "launch_base_vault must not change in early-refund branch"
            );
            return;
        }

        // Invariant 4: Success branch when totalApprovedAmount >= minimumRaiseAmount.
        assert!(
            matches!(post_launch.state, LaunchState::Complete),
            "post-state must be Complete when approvals >= minimum_raise_amount"
        );
        assert_eq!(
            post_launch.dao,
            Some(dao),
            "dao must be set to the dao account"
        );
        assert_eq!(
            post_launch.daoVault,
            Some(squads_multisig_vault),
            "daoVault must be set to squads_multisig_vault"
        );
        let completed_at = post_launch
            .unixTimestampCompleted
            .expect("unixTimestampCompleted must be Some after CompleteLaunch success path");
        assert!(
            completed_at >= timestamp_before_tx,
            "unixTimestampCompleted must be >= timestamp_before_tx"
        );
        assert!(
            completed_at <= timestamp_after_tx,
            "unixTimestampCompleted must be <= timestamp_after_tx"
        );
        assert_eq!(
            post_launch.seqNum,
            pre_launch
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "seqNum must increment by exactly 1 on CompleteLaunch success path"
        );

        // Invariant 5: Launch totals must not change (only state/dao fields are updated here).
        assert_eq!(
            post_launch.totalCommittedAmount, pre_launch.totalCommittedAmount,
            "totalCommittedAmount must not change"
        );
        assert_eq!(
            post_launch.totalApprovedAmount, pre_launch.totalApprovedAmount,
            "totalApprovedAmount must not change"
        );

        // Invariant 6: Expected USDC allocations must be computed from pre-state.
        let usdc_to_lp = pre_launch.totalApprovedAmount / 5;
        let usdc_to_dao = pre_launch.totalApprovedAmount - usdc_to_lp;
        let usdc_to_dao_treasury = usdc_to_dao.min(pre_launch.minimumRaiseAmount);
        let usdc_to_bid_wall = usdc_to_dao - usdc_to_dao_treasury;
        let refundable_usdc = pre_launch
            .totalCommittedAmount
            .checked_sub(pre_launch.totalApprovedAmount)
            .expect(
                "totalCommittedAmount must be >= totalApprovedAmount if CompleteLaunch succeeded",
            );

        // Invariant 7: Treasury quote account must increase by usdc_to_dao_treasury.
        let post_treasury_quote_amount = self
            .trident
            .get_token_account(treasury_quote_account)
            .expect("treasury_quote_account must exist after CompleteLaunch")
            .account
            .amount;
        let treasury_delta = post_treasury_quote_amount
            .checked_sub(pre_treasury_quote_amount)
            .expect("treasury quote must not decrease");
        assert_eq!(
            treasury_delta, usdc_to_dao_treasury,
            "treasury_quote_account must increase by usdc_to_dao_treasury"
        );

        // Invariant 8: If a bid wall is funded, bid wall quote token account must increase by usdc_to_bid_wall.
        if usdc_to_bid_wall > 0 {
            let post_bid_wall_quote_amount = self
                .trident
                .get_token_account(bid_wall_quote_token_account)
                .expect("bid_wall_quote_token_account must exist after CompleteLaunch")
                .account
                .amount;
            let bid_wall_delta = post_bid_wall_quote_amount
                .checked_sub(pre_bid_wall_quote_amount)
                .expect("bid wall quote must not decrease");
            assert_eq!(
                bid_wall_delta, usdc_to_bid_wall,
                "bid_wall_quote_token_account must increase by usdc_to_bid_wall"
            );
        }

        // Invariant 9: Launch quote vault must retain at least refundable_usdc.
        let post_launch_quote_amount = self
            .trident
            .get_token_account(launch_quote_vault)
            .expect("launch_quote_vault must exist after CompleteLaunch")
            .account
            .amount;
        assert!(
            post_launch_quote_amount >= refundable_usdc,
            "launch_quote_vault must have at least refundable_usdc remaining"
        );

        // Invariant 10: Launch base vault must retain enough tokens for claim + additional + performance package.
        let post_launch_base_amount = self
            .trident
            .get_token_account(launch_base_vault)
            .expect("launch_base_vault must exist after CompleteLaunch")
            .account
            .amount;
        let min_base_required = TOKENS_TO_PARTICIPANTS
            .saturating_add(pre_launch.additionalTokensAmount)
            .saturating_add(pre_launch.performancePackageTokenAmount);
        assert!(
            post_launch_base_amount >= min_base_required,
            "launch_base_vault must retain enough tokens for claim + additional + performance package"
        );
        assert!(
            post_launch_quote_amount <= pre_launch_quote_amount,
            "launch_quote_vault should not increase during CompleteLaunch"
        );
        assert!(
            post_launch_base_amount <= pre_launch_base_amount,
            "launch_base_vault should not increase during CompleteLaunch"
        );
    }
}
