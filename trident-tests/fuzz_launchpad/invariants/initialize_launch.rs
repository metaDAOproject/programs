#![allow(clippy::too_many_arguments)]

use crate::common::constants::LAUNCHPAD_SEED_PREFIX;
use crate::common::constants::LAUNCH_SIGNER_SEED_PREFIX;
use crate::common::constants::TOKEN_PROGRAM_ID;
use crate::common::types::launchpad_v_7::InitializeLaunchArgs;
use crate::common::types::launchpad_v_7::Launch;
use crate::common::types::launchpad_v_7::LaunchState;
use crate::common::types::launchpad_v_7::{self};
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;
use trident_fuzz::invariant;
use trident_fuzz::invariant_eq;

const TOKEN_SCALE: u64 = 1_000_000;
const TOKENS_TO_PARTICIPANTS: u64 = 10_000_000 * TOKEN_SCALE;
const TOKENS_TO_FUTARCHY_LIQUIDITY: u64 = 2_000_000 * TOKEN_SCALE;
const TOKENS_TO_DAMM_V2_LIQUIDITY: u64 = 900_000 * TOKEN_SCALE;

impl FuzzTest {
    pub fn verify_initialize_launch_invariants(
        &mut self,
        launch: Pubkey,
        base_mint: Pubkey,
        quote_mint: Pubkey,
        launch_signer: Pubkey,
        quote_vault: Pubkey,
        base_vault: Pubkey,
        launch_authority: Pubkey,
        additional_tokens_recipient: Pubkey,
        args: &InitializeLaunchArgs,
        pre_base_vault_amount: u64,
        pre_quote_vault_amount: u64,
    ) {
        let post_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist after InitializeLaunch");

        // Invariant 1: `launch` PDA and stored bump must match expected seeds.
        let (expected_launch_pda, expected_launch_bump) = self.trident.find_program_address(
            &[LAUNCHPAD_SEED_PREFIX, base_mint.as_ref()],
            &launchpad_v_7::program_id(),
        );
        invariant_eq!(launch, expected_launch_pda, "Launch PDA must match seeds");
        invariant_eq!(
            post_launch.pdaBump,
            expected_launch_bump,
            "Launch.pdaBump must match PDA derivation bump"
        );

        // Invariant 2: `launch_signer` PDA and stored bump must match expected seeds.
        let (expected_signer_pda, expected_signer_bump) = self.trident.find_program_address(
            &[LAUNCH_SIGNER_SEED_PREFIX, launch.as_ref()],
            &launchpad_v_7::program_id(),
        );
        invariant_eq!(
            launch_signer,
            expected_signer_pda,
            "launch_signer PDA must match seeds"
        );
        invariant_eq!(
            post_launch.launchSigner,
            launch_signer,
            "Launch.launchSigner must equal the passed launch_signer PDA"
        );
        invariant_eq!(
            post_launch.launchSignerPdaBump,
            expected_signer_bump,
            "Launch.launchSignerPdaBump must match PDA derivation bump"
        );

        // Invariant 3: vaults must be ATAs for (owner=launch_signer, mint=quote/base).
        let expected_quote_vault = self.trident.get_associated_token_address(
            &quote_mint,
            &launch_signer,
            &TOKEN_PROGRAM_ID,
        );
        let expected_base_vault = self.trident.get_associated_token_address(
            &base_mint,
            &launch_signer,
            &TOKEN_PROGRAM_ID,
        );
        invariant_eq!(
            quote_vault,
            expected_quote_vault,
            "quote_vault must be the ATA(quote_mint, launch_signer)"
        );
        invariant_eq!(
            base_vault,
            expected_base_vault,
            "base_vault must be the ATA(base_mint, launch_signer)"
        );

        // Invariant 4: persisted Launch fields must match args and fixed initialization values.
        invariant_eq!(
            post_launch.minimumRaiseAmount,
            args.minimumRaiseAmount,
            "minimumRaiseAmount must match args"
        );
        invariant_eq!(
            post_launch.monthlySpendingLimitAmount,
            args.monthlySpendingLimitAmount,
            "monthlySpendingLimitAmount must match args"
        );
        invariant_eq!(
            post_launch.monthlySpendingLimitMembers,
            args.monthlySpendingLimitMembers,
            "monthlySpendingLimitMembers must match args"
        );
        invariant_eq!(
            post_launch.launchAuthority,
            launch_authority,
            "launchAuthority must match passed launch_authority"
        );
        invariant_eq!(
            post_launch.launchQuoteVault,
            quote_vault,
            "launchQuoteVault must match passed quote_vault"
        );
        invariant_eq!(
            post_launch.launchBaseVault,
            base_vault,
            "launchBaseVault must match passed base_vault"
        );
        invariant_eq!(
            post_launch.baseMint,
            base_mint,
            "baseMint must match passed base_mint"
        );
        invariant_eq!(
            post_launch.quoteMint,
            quote_mint,
            "quoteMint must match passed quote_mint"
        );
        invariant_eq!(
            post_launch.secondsForLaunch,
            args.secondsForLaunch,
            "secondsForLaunch must match args"
        );
        invariant!(
            matches!(post_launch.state, LaunchState::Initialized),
            "Launch state must start as Initialized"
        );
        invariant_eq!(post_launch.seqNum, 0, "seqNum must start at 0");
        invariant_eq!(
            post_launch.totalCommittedAmount,
            0,
            "totalCommittedAmount must start at 0"
        );
        invariant_eq!(
            post_launch.totalApprovedAmount,
            0,
            "totalApprovedAmount must start at 0"
        );
        invariant_eq!(
            post_launch.unixTimestampStarted,
            None,
            "unixTimestampStarted must start as None"
        );
        invariant_eq!(
            post_launch.unixTimestampClosed,
            None,
            "unixTimestampClosed must start as None"
        );
        invariant_eq!(post_launch.dao, None, "dao must start as None");
        invariant_eq!(post_launch.daoVault, None, "daoVault must start as None");
        invariant_eq!(
            post_launch.performancePackageGrantee,
            args.performancePackageGrantee,
            "performancePackageGrantee must match args"
        );
        invariant_eq!(
            post_launch.performancePackageTokenAmount,
            args.performancePackageTokenAmount,
            "performancePackageTokenAmount must match args"
        );
        invariant_eq!(
            post_launch.monthsUntilInsidersCanUnlock,
            args.monthsUntilInsidersCanUnlock,
            "monthsUntilInsidersCanUnlock must match args"
        );
        invariant_eq!(
            post_launch.teamAddress,
            args.teamAddress,
            "teamAddress must match args"
        );
        invariant_eq!(
            post_launch.additionalTokensAmount,
            args.additionalTokensAmount,
            "additionalTokensAmount must match args"
        );
        if args.additionalTokensAmount > 0 {
            invariant_eq!(
                post_launch.additionalTokensRecipient,
                Some(additional_tokens_recipient),
                "additionalTokensRecipient must be Some(recipient) when additionalTokensAmount > 0"
            );
        } else {
            invariant_eq!(
                post_launch.additionalTokensRecipient,
                None,
                "additionalTokensRecipient must be None when additionalTokensAmount == 0"
            );
        }
        invariant!(
            !post_launch.additionalTokensClaimed,
            "additionalTokensClaimed must start false"
        );
        invariant_eq!(
            post_launch.unixTimestampCompleted,
            None,
            "unixTimestampCompleted must start as None"
        );
        invariant!(
            !post_launch.isPerformancePackageInitialized,
            "isPerformancePackageInitialized must start false"
        );

        // Invariant 5: quote vault must not change during InitializeLaunch.
        let post_quote_vault_amount = self
            .trident
            .get_token_account(quote_vault)
            .expect("quote_vault token account must exist after InitializeLaunch")
            .account
            .amount;
        invariant_eq!(
            post_quote_vault_amount,
            pre_quote_vault_amount,
            "quote_vault amount must not change during InitializeLaunch"
        );

        // Invariant 6: base vault amount must increase by exactly the minted total.
        let post_base_vault = self
            .trident
            .get_token_account(base_vault)
            .expect("base_vault token account must exist after InitializeLaunch")
            .account;
        invariant_eq!(
            post_base_vault.mint,
            base_mint,
            "base_vault mint must equal base_mint"
        );
        invariant_eq!(
            post_base_vault.owner,
            launch_signer,
            "base_vault owner must equal launch_signer"
        );

        let expected_mint_to = args
            .performancePackageTokenAmount
            .saturating_add(args.additionalTokensAmount)
            .saturating_add(TOKENS_TO_PARTICIPANTS)
            .saturating_add(TOKENS_TO_FUTARCHY_LIQUIDITY)
            .saturating_add(TOKENS_TO_DAMM_V2_LIQUIDITY);

        let base_delta = post_base_vault
            .amount
            .checked_sub(pre_base_vault_amount)
            .expect("base_vault amount must not decrease during InitializeLaunch");
        invariant_eq!(
            base_delta,
            expected_mint_to,
            "base_vault must be minted exactly the expected total supply"
        );
    }
}
