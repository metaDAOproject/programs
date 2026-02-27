#![allow(clippy::too_many_arguments)]

use crate::common::constants::FUNDING_RECORD_SEED_PREFIX;
use crate::common::types::launchpad_v_7::FundingRecord;
use crate::common::types::launchpad_v_7::Launch;
use crate::common::types::launchpad_v_7::LaunchState;
use crate::common::types::launchpad_v_7::{self};
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;

impl FuzzTest {
    pub fn verify_fund_invariants(
        &mut self,
        launch: Pubkey,
        funding_record: Pubkey,
        launch_signer: Pubkey,
        launch_quote_vault: Pubkey,
        funder: Pubkey,
        funder_quote_account: Pubkey,
        amount: u64,
        pre_launch: &Launch,
        pre_funding_record: Option<&FundingRecord>,
        pre_launch_quote_vault_amount: u64,
        pre_funder_quote_amount: u64,
        timestamp_before_tx: i64,
    ) {
        let post_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist after Fund");
        let post_funding_record = self
            .trident
            .get_account_with_type::<FundingRecord>(&funding_record, Some(8))
            .expect("FundingRecord must exist after Fund");

        // Invariant 1: Basic success preconditions.
        assert!(amount > 0, "amount must be > 0 if Fund succeeded");
        assert!(
            matches!(pre_launch.state, LaunchState::Live),
            "pre-state must be Live if Fund succeeded"
        );

        // Invariant 2: `launch` has_one constraints must hold.
        assert_eq!(
            pre_launch.launchSigner, launch_signer,
            "launch_signer must match Launch.launchSigner"
        );
        assert_eq!(
            pre_launch.launchQuoteVault, launch_quote_vault,
            "launch_quote_vault must match Launch.launchQuoteVault"
        );

        // Invariant 3: Launch state must stay Live.
        assert!(
            matches!(post_launch.state, LaunchState::Live),
            "state must remain Live after Fund"
        );

        // Invariant 4: Launch must not be expired at time of tx.
        let started = pre_launch
            .unixTimestampStarted
            .expect("unixTimestampStarted must be Some if Fund succeeded");
        let expiry = started.saturating_add(pre_launch.secondsForLaunch as i64);
        let timestamp_after_tx = self.trident.get_current_timestamp();
        assert!(
            timestamp_before_tx <= expiry,
            "Fund must occur before expiry (timestamp_before_tx)"
        );
        assert!(
            timestamp_after_tx <= expiry,
            "Fund must occur before expiry (timestamp_after_tx)"
        );

        // Invariant 5: FundingRecord PDA + bump must match expected derivation.
        let (expected_fr_pda, expected_fr_bump) = self.trident.find_program_address(
            &[FUNDING_RECORD_SEED_PREFIX, launch.as_ref(), funder.as_ref()],
            &launchpad_v_7::program_id(),
        );
        assert_eq!(
            funding_record, expected_fr_pda,
            "FundingRecord PDA must match seeds (funding_record, launch, funder)"
        );
        assert_eq!(
            post_funding_record.pdaBump, expected_fr_bump,
            "FundingRecord.pdaBump must match PDA derivation bump"
        );

        // Invariant 6: FundingRecord fields must be correct and update rules must hold.
        assert_eq!(
            post_funding_record.funder, funder,
            "FundingRecord.funder must equal funder"
        );
        assert_eq!(
            post_funding_record.launch, launch,
            "FundingRecord.launch must equal launch"
        );

        match pre_funding_record {
            Some(pre_fr) => {
                // Existing record: committedAmount increases by amount.
                assert_eq!(
                    post_funding_record.committedAmount,
                    pre_fr
                        .committedAmount
                        .checked_add(amount)
                        .expect("committedAmount overflow should be impossible"),
                    "committedAmount must increase by amount"
                );
                // These flags should not flip during funding.
                assert_eq!(
                    post_funding_record.isTokensClaimed, pre_fr.isTokensClaimed,
                    "isTokensClaimed must not change during Fund"
                );
                assert_eq!(
                    post_funding_record.isUsdcRefunded, pre_fr.isUsdcRefunded,
                    "isUsdcRefunded must not change during Fund"
                );
                assert_eq!(
                    post_funding_record.approvedAmount, pre_fr.approvedAmount,
                    "approvedAmount must not change during Fund"
                );
            }
            None => {
                // New record: committedAmount == amount, flags false, approvedAmount == 0.
                assert_eq!(
                    post_funding_record.committedAmount, amount,
                    "new FundingRecord.committedAmount must equal amount"
                );
                assert!(
                    !post_funding_record.isTokensClaimed,
                    "new FundingRecord.isTokensClaimed must be false"
                );
                assert!(
                    !post_funding_record.isUsdcRefunded,
                    "new FundingRecord.isUsdcRefunded must be false"
                );
                assert_eq!(
                    post_funding_record.approvedAmount, 0,
                    "new FundingRecord.approvedAmount must start at 0"
                );
            }
        }

        // Invariant 7: Token accounting must match a transfer of `amount` from funder -> vault.
        let post_vault_amount = self
            .trident
            .get_token_account(launch_quote_vault)
            .expect("launch_quote_vault token account must exist after Fund")
            .account
            .amount;
        let post_funder_amount = self
            .trident
            .get_token_account(funder_quote_account)
            .expect("funder_quote_account token account must exist after Fund")
            .account
            .amount;

        let vault_delta = post_vault_amount
            .checked_sub(pre_launch_quote_vault_amount)
            .expect("vault amount must not decrease during Fund");
        let funder_delta = pre_funder_quote_amount
            .checked_sub(post_funder_amount)
            .expect("funder amount must not increase during Fund");

        assert_eq!(vault_delta, amount, "vault must increase by amount");
        assert_eq!(funder_delta, amount, "funder must decrease by amount");

        // Invariant 8: Launch accounting must reflect the funding.
        assert_eq!(
            post_launch.totalCommittedAmount,
            pre_launch
                .totalCommittedAmount
                .checked_add(amount)
                .expect("totalCommittedAmount overflow should be impossible"),
            "Launch.totalCommittedAmount must increase by amount"
        );
        assert_eq!(
            post_launch.seqNum,
            pre_launch
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "Launch.seqNum must increment by exactly 1"
        );

        // Invariant 9: Unrelated Launch fields must not change.
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
