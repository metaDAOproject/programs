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

// Keep in sync with `programs/v07_launchpad/src/lib.rs`.
const TOKEN_SCALE: u64 = 1_000_000;
const TOKENS_TO_PARTICIPANTS: u64 = 10_000_000 * TOKEN_SCALE;

impl FuzzTest {
    pub fn verify_claim_invariants(
        &mut self,
        launch: Pubkey,
        funding_record: Pubkey,
        launch_signer: Pubkey,
        base_mint: Pubkey,
        launch_base_vault: Pubkey,
        funder: Pubkey,
        funder_token_account: Pubkey,
        pre_launch: &Launch,
        pre_funding_record: &FundingRecord,
        pre_vault_amount: u64,
        pre_funder_token_amount: u64,
    ) {
        let post_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist after Claim");
        let post_funding_record = self
            .trident
            .get_account_with_type::<FundingRecord>(&funding_record, Some(8))
            .expect("FundingRecord must exist after Claim");

        // Invariant 1: Must be Complete, and tokens not previously claimed, if tx succeeded.
        invariant!(
            matches!(pre_launch.state, LaunchState::Complete),
            "pre-state must be Complete if Claim succeeded"
        );
        invariant!(
            !pre_funding_record.isTokensClaimed,
            "pre FundingRecord.isTokensClaimed must be false if Claim succeeded"
        );

        // Invariant 2: `launch` has_one constraints must hold.
        invariant_eq!(
            pre_launch.launchSigner,
            launch_signer,
            "launch_signer must match Launch.launchSigner"
        );
        invariant_eq!(
            pre_launch.baseMint,
            base_mint,
            "base_mint must match Launch.baseMint"
        );
        invariant_eq!(
            pre_launch.launchBaseVault,
            launch_base_vault,
            "launch_base_vault must match Launch.launchBaseVault"
        );

        // Invariant 3: FundingRecord PDA + has_one funder must hold.
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

        // Invariant 4: Token amount computation must match approvedAmount/totalApprovedAmount * TOKENS_TO_PARTICIPANTS.
        invariant!(
            pre_launch.totalApprovedAmount > 0,
            "totalApprovedAmount must be > 0 if Claim succeeded"
        );

        let expected_token_amount_u128 = (pre_funding_record.approvedAmount as u128)
            .checked_mul(TOKENS_TO_PARTICIPANTS as u128)
            .expect("token_amount multiplication overflow should be impossible")
            .checked_div(pre_launch.totalApprovedAmount as u128)
            .expect("division by zero should be impossible");
        invariant!(
            expected_token_amount_u128 <= u64::MAX as u128,
            "expected token amount must fit in u64"
        );
        let expected_token_amount = expected_token_amount_u128 as u64;

        // Invariant 5: FundingRecord mutation must flip isTokensClaimed and preserve other fields.
        invariant!(
            post_funding_record.isTokensClaimed,
            "FundingRecord.isTokensClaimed must be true after Claim"
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
            post_funding_record.isUsdcRefunded,
            pre_funding_record.isUsdcRefunded,
            "isUsdcRefunded must not change"
        );

        // Invariant 6: Token accounting must transfer expected_token_amount (vault -> funder).
        let post_vault_amount = self
            .trident
            .get_token_account(launch_base_vault)
            .expect("launch_base_vault token account must exist after Claim")
            .account
            .amount;
        let post_funder_token_amount = self
            .trident
            .get_token_account(funder_token_account)
            .expect("funder_token_account must exist after Claim")
            .account
            .amount;

        let vault_delta = pre_vault_amount
            .checked_sub(post_vault_amount)
            .expect("vault amount must not increase during Claim");
        let funder_delta = post_funder_token_amount
            .checked_sub(pre_funder_token_amount)
            .expect("funder token amount must not decrease during Claim");

        invariant_eq!(
            vault_delta,
            expected_token_amount,
            "vault must decrease by expected_token_amount"
        );
        invariant_eq!(
            funder_delta,
            expected_token_amount,
            "funder must receive expected_token_amount"
        );

        // Invariant 7: Launch mutation must increment seqNum by 1 and keep state Complete.
        invariant_eq!(
            post_launch.seqNum,
            pre_launch
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "seqNum must increment by exactly 1 on Claim"
        );
        match (&post_launch.state, &pre_launch.state) {
            (LaunchState::Complete, LaunchState::Complete) => {}
            _ => panic!("Launch.state must remain Complete during Claim"),
        }
        invariant_eq!(
            post_launch.totalApprovedAmount,
            pre_launch.totalApprovedAmount,
            "totalApprovedAmount must not change"
        );
        invariant_eq!(
            post_launch.totalCommittedAmount,
            pre_launch.totalCommittedAmount,
            "totalCommittedAmount must not change"
        );
    }
}
