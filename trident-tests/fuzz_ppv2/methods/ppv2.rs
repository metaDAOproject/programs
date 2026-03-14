#![allow(clippy::too_many_arguments)]

use crate::common::types::mint_governor;
use crate::common::types::performance_package_v_2;
use crate::common::types::performance_package_v_2::*;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

use crate::common::constants::*;
use crate::common::pda::get_event_authority_pda;

impl FuzzTest {
    pub fn initialize_performance_package(
        &mut self,
        payer: Pubkey,
        performance_package: Pubkey,
        token_mint: Pubkey,
        mint_governor: Pubkey,
        mint_authority: Pubkey,
        create_key: Pubkey,
        authority: Pubkey,
        recipient: Pubkey,
        args: InitializePerformancePackageArgs,
        message: Option<&str>,
    ) {
        let event_authority = get_event_authority_pda(
            &mut self.trident,
            performance_package_v_2::program_id(),
        );

        let init_performance_package = performance_package_v_2::InitializePerformancePackageInstruction::data(
            performance_package_v_2::InitializePerformancePackageInstructionData::new(
                args.clone(),
            ),
        )
        .accounts(performance_package_v_2::InitializePerformancePackageInstructionAccounts::new(
            performance_package,
            token_mint,
            mint_governor,
            mint_authority,
            create_key,
            authority,
            recipient,
            payer,
            SOLANA_PROGRAM_ID,
            event_authority,
            performance_package_v_2::program_id(),
        ))
        .instruction();

        let res = self.trident
            .process_transaction(&[init_performance_package], message);


        if !res.is_success() {
            return;
        }

        // Verify invariants
        self.verify_initialize_performance_package_invariants(
            performance_package, 
            create_key, 
            token_mint, 
            mint_governor, 
            mint_authority, 
            authority, 
            recipient, 
            &args
        );
    }

    pub fn change_authority(
        &mut self,
        performance_package: Pubkey,
        current_authority: Pubkey,
        new_authority: Pubkey,
        message: Option<&str>,
    ) {
        let pre_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist before ChangeAuthority");

        let event_authority = get_event_authority_pda(
            &mut self.trident,
            performance_package_v_2::program_id(),
        );

        let change_authority = performance_package_v_2::ChangeAuthorityInstruction::data(
            performance_package_v_2::ChangeAuthorityInstructionData::new(),
        )
        .accounts(performance_package_v_2::ChangeAuthorityInstructionAccounts::new(
            performance_package,
            current_authority,
            new_authority,
            event_authority,
            performance_package_v_2::program_id(),
        ))
        .instruction();

        let res = self
            .trident
            .process_transaction(&[change_authority], message);

        if !res.is_success() {
            return;
        }

        // Verify invariants
        self.verify_change_authority_invariants(performance_package, current_authority, new_authority, &pre_pp);
    }

    pub fn propose_change(
        &mut self,
        payer: Pubkey,
        change_request: Pubkey,
        performance_package: Pubkey,
        proposer: Pubkey,
        args: ProposeChangeArgs,
        message: Option<&str>,
    ) {
        let pre_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist before ProposeChange");
        let timestamp_before_tx = self.trident.get_current_timestamp();

        let event_authority = get_event_authority_pda(
            &mut self.trident,
            performance_package_v_2::program_id(),
        );

        let propose_change = performance_package_v_2::ProposeChangeInstruction::data(
            performance_package_v_2::ProposeChangeInstructionData::new(args.clone()),
        )
        .accounts(
            performance_package_v_2::ProposeChangeInstructionAccounts::new(
                performance_package,
                change_request,
                proposer,
                payer,
                SOLANA_PROGRAM_ID,
                event_authority,
                performance_package_v_2::program_id(),
            ),
        )
        .instruction();

        let res = self.trident.process_transaction(&[propose_change], message);

        if !res.is_success() {
            return;
        }

        // Verify invariants
        self.verify_propose_change_invariants(change_request, performance_package, proposer, &args, &pre_pp, timestamp_before_tx);
    }

    pub fn execute_change(
        &mut self,
        change_request: Pubkey,
        performance_package: Pubkey,
        executor: Pubkey,
        rent_destination: Pubkey,
        message: Option<&str>,
    ) {
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
            performance_package_v_2::program_id(),
        );

        let execute_change = performance_package_v_2::ExecuteChangeInstruction::data(
            performance_package_v_2::ExecuteChangeInstructionData::new(),
        )
        .accounts(
            performance_package_v_2::ExecuteChangeInstructionAccounts::new(
                performance_package,
                change_request,
                executor,
                rent_destination,
                event_authority,
                performance_package_v_2::program_id(),
            ),
        )
        .instruction();

        let res = self.trident.process_transaction(&[execute_change], message);

        if !res.is_success() {
            return;
        }

        // Verify invariants
        self.verify_execute_change_invariants(change_request, performance_package, executor, &pre_pp, &pre_cr);
    }

    pub fn start_unlock(
        &mut self,
        recipient: Pubkey,
        performance_package: Pubkey,
        message: Option<&str>,
    ) {
        let pre_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist before StartUnlock");
        let timestamp_before_tx = self.trident.get_current_timestamp();
        let event_authority = get_event_authority_pda(
            &mut self.trident,
            performance_package_v_2::program_id(),
        );

        let start_unlock = performance_package_v_2::StartUnlockInstruction::data(
            performance_package_v_2::StartUnlockInstructionData::new(),
        )
        .accounts(
            performance_package_v_2::StartUnlockInstructionAccounts::new(
                performance_package,
                recipient,
                event_authority,
                performance_package_v_2::program_id(),
            ),
        )
        .instruction();

        let res = self.trident.process_transaction(&[start_unlock], message);

        if !res.is_success() {
            return;
        }

        // Verify invariants
        self.verify_start_unlock_invariants(performance_package, recipient, &pre_pp, timestamp_before_tx);
    }

    pub fn complete_unlock(
        &mut self,
        performance_package: Pubkey,
        mint_governor: Pubkey,
        mint_authority: Pubkey,
        token_mint: Pubkey,
        recipient_token_account: Pubkey,
        signer: Pubkey,
        message: Option<&str>,
    ) {
        let pre_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist before CompleteUnlock");
        let timestamp_before_tx = self.trident.get_current_timestamp();
        let pre_recipient_amount = self
            .trident
            .get_token_account(recipient_token_account)
            .expect("Recipient token account must exist before CompleteUnlock")
            .account
            .amount;
        let event_authority =
            get_event_authority_pda(&mut self.trident, performance_package_v_2::program_id());
        let mint_governor_event_authority =
            get_event_authority_pda(&mut self.trident, mint_governor::program_id());

        let complete_unlock = performance_package_v_2::CompleteUnlockInstruction::data(
            performance_package_v_2::CompleteUnlockInstructionData::new(),
        )
        .accounts(
            performance_package_v_2::CompleteUnlockInstructionAccounts::new(
                performance_package,
                mint_governor,
                mint_authority,
                token_mint,
                recipient_token_account,
                signer,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID,
                mint_governor::program_id(),
                mint_governor_event_authority,
                event_authority,
                performance_package_v_2::program_id(),
            ),
        )
        .instruction();

        let res = self.trident
            .process_transaction(&[complete_unlock], message);

        if !res.is_success() {
            return;
        }

        // Verify invariants
        self.verify_complete_unlock_invariants(performance_package, mint_governor, mint_authority, token_mint, recipient_token_account, signer, &pre_pp, pre_recipient_amount, timestamp_before_tx);
    }

    pub fn close_performance_package(
        &mut self,
        performance_package: Pubkey,
        admin: Pubkey,
        rent_destination: Pubkey,
        message: Option<&str>,
    ) {
        let pre_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist before ClosePerformancePackage");
        let event_authority =
            get_event_authority_pda(&mut self.trident, performance_package_v_2::program_id());

        let close_performance_package =
            performance_package_v_2::ClosePerformancePackageInstruction::data(
                performance_package_v_2::ClosePerformancePackageInstructionData::new(),
            )
            .accounts(
                performance_package_v_2::ClosePerformancePackageInstructionAccounts::new(
                    performance_package,
                    admin,
                    rent_destination,
                    event_authority,
                    performance_package_v_2::program_id(),
                ),
            )
            .instruction();

        let res = self.trident
            .process_transaction(&[close_performance_package], message);

        if !res.is_success() {
            return;
        }

        // Verify invariants
        self.verify_close_performance_package_invariants(performance_package, &pre_pp);
    }
}
