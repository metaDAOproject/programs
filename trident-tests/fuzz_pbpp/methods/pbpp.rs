#![allow(clippy::too_many_arguments)]

use crate::common::types::price_based_performance_package;
use crate::common::types::price_based_performance_package::*;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

use crate::common::constants::*;
use crate::common::pda::get_event_authority_pda;

impl FuzzTest {
    pub fn initialize_performance_package(
        &mut self,
        payer: Pubkey,
        performance_package: Pubkey,
        create_key: Pubkey,
        token_mint: Pubkey,
        grantor_token_account: Pubkey,
        grantor: Pubkey,
        performance_package_token_vault: Pubkey,
        args: InitializePerformancePackageParams,
        message: Option<&str>,
    ) {
        let event_authority = get_event_authority_pda(
            &mut self.trident,
            price_based_performance_package::program_id(),
        );

        // Capture pre-state for invariants
        let args_for_invariants = args.clone();
        let timestamp_before_tx = self.trident.get_current_timestamp();
        let initial_grantor_token_amount = self
            .trident
            .get_token_account(grantor_token_account)
            .expect("Grantor token account must exist before initialization")
            .account
            .amount;
        let initial_vault_token_amount = self
            .trident
            .get_token_account(performance_package_token_vault)
            .map(|acc| acc.account.amount)
            .unwrap_or(0);

        // Setup instruction
        let init_performance_package = price_based_performance_package::InitializePerformancePackageInstruction::data(
            price_based_performance_package::InitializePerformancePackageInstructionData::new(
                args,
            ),
        )
        .accounts(price_based_performance_package::InitializePerformancePackageInstructionAccounts::new(
            performance_package,
            create_key,
            token_mint,
            grantor_token_account,
            grantor,
            performance_package_token_vault,
            payer,
            SOLANA_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
            event_authority,
            price_based_performance_package::program_id(),
        ))
        .instruction();

        let res = self
            .trident
            .process_transaction(&[init_performance_package], message);

        if !res.is_success() {
            return;
        }

        // Verify invariants
        self.verify_initialize_performance_package_invariants(
            performance_package,
            create_key,
            token_mint,
            grantor_token_account,
            grantor,
            performance_package_token_vault,
            &args_for_invariants,
            initial_grantor_token_amount,
            initial_vault_token_amount,
            timestamp_before_tx,
        );
    }

    pub fn change_performance_package_authority(
        &mut self,
        performance_package: Pubkey,
        current_authority: Pubkey,
        args: ChangePerformancePackageAuthorityParams,
        message: Option<&str>,
    ) {
        // Capture pre-state for invariants
        let args_for_invariants = args.clone();
        let pre_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist before ChangePerformancePackageAuthority");

        let event_authority = get_event_authority_pda(
            &mut self.trident,
            price_based_performance_package::program_id(),
        );

        // Setup instruction
        let change_performance_package_authority = price_based_performance_package::ChangePerformancePackageAuthorityInstruction::data(
            price_based_performance_package::ChangePerformancePackageAuthorityInstructionData::new(
                args,
            ),
        )
        .accounts(price_based_performance_package::ChangePerformancePackageAuthorityInstructionAccounts::new(
            performance_package,
            current_authority,
            event_authority,
            price_based_performance_package::program_id(),
        ))
        .instruction();

        let res = self
            .trident
            .process_transaction(&[change_performance_package_authority], message);

        if !res.is_success() {
            return;
        }

        // Verify invariants
        self.verify_change_performance_package_authority_invariants(
            performance_package,
            current_authority,
            &args_for_invariants,
            &pre_pp,
        );
    }

    pub fn propose_change(
        &mut self,
        payer: Pubkey,
        change_request: Pubkey,
        performance_package: Pubkey,
        proposer: Pubkey,
        args: ProposeChangeParams,
        message: Option<&str>,
    ) {
        let event_authority = get_event_authority_pda(
            &mut self.trident,
            price_based_performance_package::program_id(),
        );

        // Capture pre-state for invariants
        let args_for_invariants = args.clone();
        let timestamp_before_tx = self.trident.get_current_timestamp();
        let pre_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist before ProposeChange");

        // Setup instruction
        let propose_change = price_based_performance_package::ProposeChangeInstruction::data(
            price_based_performance_package::ProposeChangeInstructionData::new(args),
        )
        .accounts(
            price_based_performance_package::ProposeChangeInstructionAccounts::new(
                change_request,
                performance_package,
                proposer,
                payer,
                SOLANA_PROGRAM_ID,
                event_authority,
                price_based_performance_package::program_id(),
            ),
        )
        .instruction();

        let res = self.trident.process_transaction(&[propose_change], message);

        if !res.is_success() {
            return;
        }

        // Verify invariants
        self.verify_propose_change_invariants(
            change_request,
            performance_package,
            proposer,
            &args_for_invariants,
            &pre_pp,
            timestamp_before_tx,
        );
    }

    pub fn execute_change(
        &mut self,
        change_request: Pubkey,
        performance_package: Pubkey,
        executor: Pubkey,
        message: Option<&str>,
    ) {
        // Capture pre-state for invariants
        let pre_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8));
        if pre_pp.is_none() {
            return;
        }
        let pre_pp = pre_pp.unwrap();
        let pre_cr = self
            .trident
            .get_account_with_type::<ChangeRequest>(&change_request, Some(8));
        if pre_cr.is_none() {
            return;
        }
        let pre_cr = pre_cr.unwrap();

        let event_authority = get_event_authority_pda(
            &mut self.trident,
            price_based_performance_package::program_id(),
        );

        // Setup instruction
        let execute_change = price_based_performance_package::ExecuteChangeInstruction::data(
            price_based_performance_package::ExecuteChangeInstructionData::new(),
        )
        .accounts(
            price_based_performance_package::ExecuteChangeInstructionAccounts::new(
                change_request,
                performance_package,
                executor,
                event_authority,
                price_based_performance_package::program_id(),
            ),
        )
        .instruction();

        let res = self.trident.process_transaction(&[execute_change], message);

        if !res.is_success() {
            return;
        }

        // Verify invariants
        self.verify_execute_change_invariants(
            change_request,
            performance_package,
            executor,
            &pre_pp,
            &pre_cr,
        );
    }

    pub fn start_unlock(
        &mut self,
        recipient: Pubkey,
        performance_package: Pubkey,
        oracle_account: Pubkey,
        message: Option<&str>,
    ) {
        let event_authority = get_event_authority_pda(
            &mut self.trident,
            price_based_performance_package::program_id(),
        );

        // Capture pre-state for invariants
        let pre_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist before StartUnlock");
        let pre_vault_amount = self
            .trident
            .get_token_account(pre_pp.performancePackageTokenVault)
            .expect("Vault must exist before StartUnlock")
            .account
            .amount;

        // Setup instruction
        let start_unlock = price_based_performance_package::StartUnlockInstruction::data(
            price_based_performance_package::StartUnlockInstructionData::new(),
        )
        .accounts(
            price_based_performance_package::StartUnlockInstructionAccounts::new(
                performance_package,
                oracle_account,
                recipient,
                event_authority,
                price_based_performance_package::program_id(),
            ),
        )
        .instruction();

        let res = self.trident.process_transaction(&[start_unlock], message);

        if !res.is_success() {
            return;
        }

        // Verify invariants
        self.verify_start_unlock_invariants(
            performance_package,
            oracle_account,
            recipient,
            &pre_pp,
            pre_vault_amount,
        );
    }

    pub fn complete_unlock(
        &mut self,
        performance_package: Pubkey,
        oracle_account: Pubkey,
        performance_package_token_vault: Pubkey,
        token_mint: Pubkey,
        recipient_token_account: Pubkey,
        recipient: Pubkey,
        payer: Pubkey,
        message: Option<&str>,
    ) {
        let event_authority = get_event_authority_pda(
            &mut self.trident,
            price_based_performance_package::program_id(),
        );

        // Capture pre-state for invariants
        let timestamp_before_tx = self.trident.get_current_timestamp();
        let pre_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist before CompleteUnlock");
        let pre_vault_amount = self
            .trident
            .get_token_account(performance_package_token_vault)
            .expect("Vault must exist before CompleteUnlock")
            .account
            .amount;
        let pre_recipient_amount = self
            .trident
            .get_token_account(recipient_token_account)
            .map(|acc| acc.account.amount)
            .unwrap_or(0);

        // Setup instruction
        let complete_unlock = price_based_performance_package::CompleteUnlockInstruction::data(
            price_based_performance_package::CompleteUnlockInstructionData::new(),
        )
        .accounts(
            price_based_performance_package::CompleteUnlockInstructionAccounts::new(
                performance_package,
                oracle_account,
                performance_package_token_vault,
                token_mint,
                recipient_token_account,
                recipient,
                payer,
                SOLANA_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID,
                event_authority,
                price_based_performance_package::program_id(),
            ),
        )
        .instruction();

        let res = self
            .trident
            .process_transaction(&[complete_unlock], message);

        if !res.is_success() {
            return;
        }

        // Verify invariants
        self.verify_complete_unlock_invariants(
            performance_package,
            oracle_account,
            performance_package_token_vault,
            token_mint,
            recipient_token_account,
            recipient,
            &pre_pp,
            pre_vault_amount,
            pre_recipient_amount,
            timestamp_before_tx,
        );
    }
}
