#![allow(clippy::too_many_arguments)]

use crate::common::constants::FUNDING_RECORD_SEED_PREFIX;
use crate::common::types::launchpad_v_7::FundingRecord;
use crate::common::types::launchpad_v_7::Launch;
use crate::common::types::launchpad_v_7::LaunchState;
use crate::common::types::launchpad_v_7::{self};
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;

use trident_fuzz::invariant;
use trident_fuzz::invariant_eq;

impl FuzzTest {
    pub fn verify_refund_invariants(
        &mut self,
        launch: Pubkey,
        funding_record: Pubkey,
        launch_quote_vault: Pubkey,
        launch_signer: Pubkey,
        funder: Pubkey,
        funder_quote_account: Pubkey,
        pre_launch: &Launch,
        pre_funding_record: &FundingRecord,
        pre_vault_amount: u64,
        pre_funder_amount: u64,
    ) {
        let post_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist after Refund");
        let post_funding_record = self
            .trident
            .get_account_with_type::<FundingRecord>(&funding_record, Some(8))
            .expect("FundingRecord must exist after Refund");

        // Invariant 1: `launch` has_one constraints must hold.
        invariant_eq!(
            pre_launch.launchQuoteVault,
            launch_quote_vault,
            "launch_quote_vault must match Launch.launchQuoteVault"
        );
        invariant_eq!(
            pre_launch.launchSigner,
            launch_signer,
            "launch_signer must match Launch.launchSigner"
        );

        // Invariant 2: FundingRecord must match seeds and funder constraints.
        let (expected_fr_pda, _) = self.trident.find_program_address(
            &[FUNDING_RECORD_SEED_PREFIX, launch.as_ref(), funder.as_ref()],
            &launchpad_v_7::program_id(),
        );
        invariant_eq!(
            funding_record,
            expected_fr_pda,
            "FundingRecord PDA must match seeds (funding_record, launch, funder)"
        );
        invariant_eq!(
            pre_funding_record.funder,
            funder,
            "FundingRecord.funder must match provided funder"
        );
        invariant_eq!(
            pre_funding_record.launch,
            launch,
            "FundingRecord.launch must equal launch"
        );

        // Invariant 3: Refund is only valid in (Refunding|Complete) and only once.
        invariant!(
            matches!(pre_launch.state, LaunchState::Refunding)
                || matches!(pre_launch.state, LaunchState::Complete),
            "pre-state must be Refunding or Complete if Refund succeeded"
        );
        invariant!(
            !pre_funding_record.isUsdcRefunded,
            "pre FundingRecord.isUsdcRefunded must be false if Refund succeeded"
        );

        // Invariant 4: Refund must not change launch state.
        match (&post_launch.state, &pre_launch.state) {
            (LaunchState::Refunding, LaunchState::Refunding)
            | (LaunchState::Complete, LaunchState::Complete) => {}
            _ => panic!("Launch.state must not change during Refund"),
        }

        // Invariant 5: Amount refunded depends on launch state.
        let amount_to_refund = match pre_launch.state {
            LaunchState::Refunding => pre_funding_record.committedAmount,
            LaunchState::Complete => pre_funding_record
                .committedAmount
                .checked_sub(pre_funding_record.approvedAmount)
                .expect("committedAmount must be >= approvedAmount"),
            _ => unreachable!(),
        };

        // Invariant 6: FundingRecord mutation must flip isUsdcRefunded and preserve other fields.
        invariant!(
            post_funding_record.isUsdcRefunded,
            "FundingRecord.isUsdcRefunded must be true after Refund"
        );
        invariant_eq!(
            post_funding_record.committedAmount,
            pre_funding_record.committedAmount,
            "committedAmount must not change"
        );
        invariant_eq!(
            post_funding_record.approvedAmount,
            pre_funding_record.approvedAmount,
            "approvedAmount must not change"
        );
        invariant_eq!(
            post_funding_record.isTokensClaimed,
            pre_funding_record.isTokensClaimed,
            "isTokensClaimed must not change"
        );
        invariant_eq!(
            post_funding_record.funder,
            pre_funding_record.funder,
            "funder must not change"
        );
        invariant_eq!(
            post_funding_record.launch,
            pre_funding_record.launch,
            "launch must not change"
        );

        // Invariant 7: Token accounting must match amount_to_refund (vault -> funder).
        let post_vault_amount = self
            .trident
            .get_token_account(launch_quote_vault)
            .expect("launch_quote_vault token account must exist after Refund")
            .account
            .amount;
        let post_funder_amount = self
            .trident
            .get_token_account(funder_quote_account)
            .expect("funder_quote_account token account must exist after Refund")
            .account
            .amount;

        let vault_delta = pre_vault_amount
            .checked_sub(post_vault_amount)
            .expect("vault amount must not increase during Refund");
        let funder_delta = post_funder_amount
            .checked_sub(pre_funder_amount)
            .expect("funder amount must not decrease during Refund");

        invariant_eq!(
            vault_delta,
            amount_to_refund,
            "vault must decrease by amount_to_refund"
        );
        invariant_eq!(
            funder_delta,
            amount_to_refund,
            "funder must increase by amount_to_refund"
        );

        // Invariant 8: Launch seqNum must increment by 1; other fields must not change.
        invariant_eq!(
            post_launch.seqNum,
            pre_launch
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "seqNum must increment by exactly 1 on Refund"
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
            post_launch.unixTimestampStarted,
            pre_launch.unixTimestampStarted,
            "unixTimestampStarted must not change"
        );
        invariant_eq!(
            post_launch.unixTimestampClosed,
            pre_launch.unixTimestampClosed,
            "unixTimestampClosed must not change"
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
