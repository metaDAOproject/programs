#![allow(clippy::too_many_arguments)]

use crate::common::constants::TOKEN_PROGRAM_ID;
use crate::common::types::launchpad_v_7::Launch;
use crate::common::types::launchpad_v_7::LaunchState;
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;
use trident_fuzz::invariant;
use trident_fuzz::invariant_eq;

impl FuzzTest {
    pub fn verify_claim_additional_token_allocation_invariants(
        &mut self,
        launch: Pubkey,
        launch_signer: Pubkey,
        base_vault: Pubkey,
        base_mint: Pubkey,
        additional_tokens_recipient: Pubkey,
        additional_tokens_recipient_token_account: Pubkey,
        pre_launch: &Launch,
        pre_base_vault_amount: u64,
        pre_recipient_amount: u64,
    ) {
        let post_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist after ClaimAdditionalTokenAllocation");

        // Invariant 1: Must be Complete, and additional tokens not previously claimed, if tx succeeded.
        invariant!(
            matches!(pre_launch.state, LaunchState::Complete),
            "pre-state must be Complete if ClaimAdditionalTokenAllocation succeeded"
        );
        invariant!(
            !pre_launch.additionalTokensClaimed,
            "pre additionalTokensClaimed must be false if ClaimAdditionalTokenAllocation succeeded"
        );
        invariant!(
            pre_launch.additionalTokensRecipient.is_some(),
            "additionalTokensRecipient must be Some if ClaimAdditionalTokenAllocation succeeded"
        );
        invariant_eq!(
            pre_launch.additionalTokensRecipient.unwrap(),
            additional_tokens_recipient,
            "additional_tokens_recipient must match Launch.additionalTokensRecipient"
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
            base_vault,
            "base_vault must match Launch.launchBaseVault"
        );

        // Invariant 3: additional_tokens_recipient_token_account must be ATA(base_mint, additional_tokens_recipient).
        let expected_ata = self.trident.get_associated_token_address(
            &base_mint,
            &additional_tokens_recipient,
            &TOKEN_PROGRAM_ID,
        );
        invariant_eq!(
            additional_tokens_recipient_token_account, expected_ata,
            "additional_tokens_recipient_token_account must be ATA(base_mint, additional_tokens_recipient)"
        );

        // Invariant 4: Token accounting must transfer additionalTokensAmount (base_vault -> recipient).
        let post_base_vault_amount = self
            .trident
            .get_token_account(base_vault)
            .expect("base_vault token account must exist after ClaimAdditionalTokenAllocation")
            .account
            .amount;
        let post_recipient_amount = self
            .trident
            .get_token_account(additional_tokens_recipient_token_account)
            .expect("recipient token account must exist after ClaimAdditionalTokenAllocation")
            .account
            .amount;

        let vault_delta = pre_base_vault_amount
            .checked_sub(post_base_vault_amount)
            .expect("base_vault amount must not increase during ClaimAdditionalTokenAllocation");
        let recipient_delta = post_recipient_amount
            .checked_sub(pre_recipient_amount)
            .expect("recipient amount must not decrease during ClaimAdditionalTokenAllocation");

        invariant_eq!(
            vault_delta,
            pre_launch.additionalTokensAmount,
            "base_vault must decrease by additionalTokensAmount"
        );
        invariant_eq!(
            recipient_delta,
            pre_launch.additionalTokensAmount,
            "recipient must receive additionalTokensAmount"
        );

        // Invariant 5: Launch mutation must flip additionalTokensClaimed and increment seqNum by 1.
        invariant!(
            post_launch.additionalTokensClaimed,
            "additionalTokensClaimed must be true after ClaimAdditionalTokenAllocation"
        );
        invariant_eq!(
            post_launch.seqNum,
            pre_launch
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "seqNum must increment by exactly 1"
        );
        match (&post_launch.state, &pre_launch.state) {
            (LaunchState::Complete, LaunchState::Complete) => {}
            _ => panic!("Launch.state must remain Complete"),
        }
        invariant_eq!(
            post_launch.additionalTokensRecipient,
            pre_launch.additionalTokensRecipient,
            "additionalTokensRecipient must not change"
        );
        invariant_eq!(
            post_launch.additionalTokensAmount,
            pre_launch.additionalTokensAmount,
            "additionalTokensAmount must not change"
        );
    }
}
