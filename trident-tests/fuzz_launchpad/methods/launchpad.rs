#![allow(clippy::too_many_arguments)]

use crate::common::types::launchpad_v_7::MeteoraAccountsInstructionAccounts;
use crate::common::types::launchpad_v_7::StaticAccountsInstructionAccounts;
use crate::common::types::launchpad_v_7::*;
use crate::common::types::*;
use crate::FuzzTest;
use solana_sdk::compute_budget::ComputeBudgetInstruction;
use trident_fuzz::fuzzing::*;

use crate::common::constants::*;
use crate::common::pda::get_amm_position_pda;
use crate::common::pda::get_bid_wall_pda;
use crate::common::pda::get_dao_pda;
use crate::common::pda::get_event_authority_pda;
use crate::common::pda::get_pool_authority_pda;
use crate::common::pda::get_pool_creator_authority_pda;
use crate::common::pda::get_pool_pda;
use crate::common::pda::get_position_nft_account_pda;
use crate::common::pda::get_position_nft_mint_pda;
use crate::common::pda::get_position_pda;
use crate::common::pda::get_squads_multisig_pda;
use crate::common::pda::get_squads_multisig_spending_limit_pda;
use crate::common::pda::get_squads_multisig_vault_pda;
use crate::common::pda::get_token_a_vault_pda;
use crate::common::pda::get_token_b_vault_pda;
use crate::common::token::get_or_initialize_associated_token_account;

impl FuzzTest {
    pub fn initialize_launch(
        &mut self,
        payer: Pubkey,
        launch: Pubkey,
        base_mint: Pubkey,
        quote_mint: Pubkey,
        token_metadata: Pubkey,
        launch_signer: Pubkey,
        quote_vault: Pubkey,
        base_vault: Pubkey,
        launch_authority: Pubkey,
        additional_tokens_recipient: Pubkey,
        args: InitializeLaunchArgs,
        message: Option<&str>,
    ) {
        let event_authority =
            get_event_authority_pda(&mut self.trident, launchpad_v_7::program_id());

        // Capture pre-state for invariants
        let args_for_invariants = args.clone();
        let pre_quote_vault_amount = self
            .trident
            .get_token_account(quote_vault)
            .map(|acc| acc.account.amount)
            .unwrap_or(0);
        let pre_base_vault_amount = self
            .trident
            .get_token_account(base_vault)
            .map(|acc| acc.account.amount)
            .unwrap_or(0);

        let init_launch = launchpad_v_7::InitializeLaunchInstruction::data(
            launchpad_v_7::InitializeLaunchInstructionData::new(args),
        )
        .accounts(launchpad_v_7::InitializeLaunchInstructionAccounts::new(
            launch,
            base_mint,
            token_metadata,
            launch_signer,
            quote_vault,
            base_vault,
            payer,
            launch_authority,
            quote_mint,
            additional_tokens_recipient,
            RENT_SYSVAR_ID,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
            SOLANA_PROGRAM_ID,
            MPL_TOKEN_METADATA_PROGRAM_ID,
            event_authority,
            launchpad_v_7::program_id(),
        ))
        .instruction();

        let res = self.trident.process_transaction(&[init_launch], message);

        // Verify invariants
        if !res.is_success() {
            return;
        }

        self.verify_initialize_launch_invariants(
            launch,
            base_mint,
            quote_mint,
            launch_signer,
            quote_vault,
            base_vault,
            launch_authority,
            additional_tokens_recipient,
            &args_for_invariants,
            pre_base_vault_amount,
            pre_quote_vault_amount,
        );
    }

    pub fn fund(
        &mut self,
        payer: Pubkey,
        launch: Pubkey,
        funding_record: Pubkey,
        launch_signer: Pubkey,
        launch_quote_vault: Pubkey,
        funder: Pubkey,
        funder_quote_account: Pubkey,
        amount: u64,
        message: Option<&str>,
    ) {
        let event_authority =
            get_event_authority_pda(&mut self.trident, launchpad_v_7::program_id());

        // Capture pre-state for invariants
        let timestamp_before_tx = self.trident.get_current_timestamp();
        let pre_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist before Fund");
        let pre_funding_record = self
            .trident
            .get_account_with_type::<FundingRecord>(&funding_record, Some(8));
        let pre_launch_quote_vault_amount = self
            .trident
            .get_token_account(launch_quote_vault)
            .expect("launch_quote_vault token account must exist before Fund")
            .account
            .amount;
        let pre_funder_quote_amount = self
            .trident
            .get_token_account(funder_quote_account)
            .expect("funder_quote_account token account must exist before Fund")
            .account
            .amount;

        let fund_launch =
            launchpad_v_7::FundInstruction::data(launchpad_v_7::FundInstructionData::new(amount))
                .accounts(launchpad_v_7::FundInstructionAccounts::new(
                    launch,
                    funding_record,
                    launch_quote_vault,
                    funder,
                    payer,
                    funder_quote_account,
                    TOKEN_PROGRAM_ID,
                    SOLANA_PROGRAM_ID,
                    event_authority,
                    launchpad_v_7::program_id(),
                ))
                .instruction();

        let res = self.trident.process_transaction(&[fund_launch], message);

        if !res.is_success() {
            return;
        }
        // Verify invariants
        self.verify_fund_invariants(
            launch,
            funding_record,
            launch_signer,
            launch_quote_vault,
            funder,
            funder_quote_account,
            amount,
            &pre_launch,
            pre_funding_record.as_ref(),
            pre_launch_quote_vault_amount,
            pre_funder_quote_amount,
            timestamp_before_tx,
        );
    }

    pub fn start_launch(
        &mut self,
        launch: Pubkey,
        launch_authority: Pubkey,
        message: Option<&str>,
    ) {
        let event_authority =
            get_event_authority_pda(&mut self.trident, launchpad_v_7::program_id());

        // Capture pre-state for invariants
        let timestamp_before_tx = self.trident.get_current_timestamp();
        let pre_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist before StartLaunch");

        let start_launch = launchpad_v_7::StartLaunchInstruction::data(
            launchpad_v_7::StartLaunchInstructionData::new(),
        )
        .accounts(launchpad_v_7::StartLaunchInstructionAccounts::new(
            launch,
            launch_authority,
            event_authority,
            launchpad_v_7::program_id(),
        ))
        .instruction();

        let res = self.trident.process_transaction(&[start_launch], message);

        // Verify invariants
        if !res.is_success() {
            return;
        }
        self.verify_start_launch_invariants(
            launch,
            launch_authority,
            &pre_launch,
            timestamp_before_tx,
        );
    }

    pub fn set_funding_record_approval(
        &mut self,
        launch: Pubkey,
        funding_record: Pubkey,
        launch_authority: Pubkey,
        approved_amount: u64,
        message: Option<&str>,
    ) {
        let event_authority =
            get_event_authority_pda(&mut self.trident, launchpad_v_7::program_id());

        // Capture pre-state for invariants
        let pre_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist before SetFundingRecordApproval");
        let pre_funding_record = self
            .trident
            .get_account_with_type::<FundingRecord>(&funding_record, Some(8))
            .expect("FundingRecord must exist before SetFundingRecordApproval");

        let set_funding_record_approval = launchpad_v_7::SetFundingRecordApprovalInstruction::data(
            launchpad_v_7::SetFundingRecordApprovalInstructionData::new(approved_amount),
        )
        .accounts(
            launchpad_v_7::SetFundingRecordApprovalInstructionAccounts::new(
                launch,
                funding_record,
                launch_authority,
                event_authority,
                launchpad_v_7::program_id(),
            ),
        )
        .instruction();

        let res = self
            .trident
            .process_transaction(&[set_funding_record_approval], message);

        // Verify invariants
        if !res.is_success() {
            return;
        }
        self.verify_set_funding_record_approval_invariants(
            launch,
            funding_record,
            launch_authority,
            approved_amount,
            &pre_launch,
            &pre_funding_record,
        );
    }

    pub fn close_launch(&mut self, launch: Pubkey, message: Option<&str>) {
        let event_authority =
            get_event_authority_pda(&mut self.trident, launchpad_v_7::program_id());

        // Capture pre-state for invariants
        let timestamp_before_tx = self.trident.get_current_timestamp();
        let pre_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist before CloseLaunch");

        let close_launch = launchpad_v_7::CloseLaunchInstruction::data(
            launchpad_v_7::CloseLaunchInstructionData::new(),
        )
        .accounts(launchpad_v_7::CloseLaunchInstructionAccounts::new(
            launch,
            event_authority,
            launchpad_v_7::program_id(),
        ))
        .instruction();

        let res = self.trident.process_transaction(&[close_launch], message);

        // Verify invariants
        if !res.is_success() {
            return;
        }
        self.verify_close_launch_invariants(launch, &pre_launch, timestamp_before_tx);
    }

    pub fn refund(
        &mut self,
        launch: Pubkey,
        funding_record: Pubkey,
        launch_quote_vault: Pubkey,
        launch_signer: Pubkey,
        funder: Pubkey,
        funder_quote_account: Pubkey,
        message: Option<&str>,
    ) {
        let event_authority =
            get_event_authority_pda(&mut self.trident, launchpad_v_7::program_id());

        // Capture pre-state for invariants
        let pre_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist before Refund");
        let pre_funding_record = self
            .trident
            .get_account_with_type::<FundingRecord>(&funding_record, Some(8));
        if pre_funding_record.is_none() {
            return;
        }
        let pre_funding_record = pre_funding_record.unwrap();
        let pre_vault_amount = self
            .trident
            .get_token_account(launch_quote_vault)
            .expect("launch_quote_vault token account must exist before Refund")
            .account
            .amount;
        let pre_funder_amount = self
            .trident
            .get_token_account(funder_quote_account)
            .expect("funder_quote_account token account must exist before Refund")
            .account
            .amount;

        let refund =
            launchpad_v_7::RefundInstruction::data(launchpad_v_7::RefundInstructionData::new())
                .accounts(launchpad_v_7::RefundInstructionAccounts::new(
                    launch,
                    funding_record,
                    launch_quote_vault,
                    launch_signer,
                    funder,
                    funder_quote_account,
                    TOKEN_PROGRAM_ID,
                    event_authority,
                    launchpad_v_7::program_id(),
                ))
                .instruction();

        let res = self.trident.process_transaction(&[refund], message);

        // Verify invariants
        if !res.is_success() {
            return;
        }
        self.verify_refund_invariants(
            launch,
            funding_record,
            launch_quote_vault,
            launch_signer,
            funder,
            funder_quote_account,
            &pre_launch,
            &pre_funding_record,
            pre_vault_amount,
            pre_funder_amount,
        );
    }

    pub fn claim(
        &mut self,
        launch: Pubkey,
        funding_record: Pubkey,
        launch_signer: Pubkey,
        base_mint: Pubkey,
        launch_base_vault: Pubkey,
        funder: Pubkey,
        funder_quote_account: Pubkey,
        message: Option<&str>,
    ) {
        let event_authority =
            get_event_authority_pda(&mut self.trident, launchpad_v_7::program_id());

        // Capture pre-state for invariants
        let pre_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist before Claim");
        let pre_funding_record = self
            .trident
            .get_account_with_type::<FundingRecord>(&funding_record, Some(8));
        if pre_funding_record.is_none() {
            return;
        }
        let pre_funding_record = pre_funding_record.unwrap();
        let pre_vault_amount = self
            .trident
            .get_token_account(launch_base_vault)
            .expect("launch_base_vault token account must exist before Claim")
            .account
            .amount;
        let pre_funder_token_amount = self
            .trident
            .get_token_account(funder_quote_account)
            .map(|acc| acc.account.amount)
            .unwrap_or(0);

        let claim =
            launchpad_v_7::ClaimInstruction::data(launchpad_v_7::ClaimInstructionData::new())
                .accounts(launchpad_v_7::ClaimInstructionAccounts::new(
                    launch,
                    funding_record,
                    launch_signer,
                    base_mint,
                    launch_base_vault,
                    funder,
                    funder_quote_account,
                    TOKEN_PROGRAM_ID,
                    event_authority,
                    launchpad_v_7::program_id(),
                ))
                .instruction();

        let res = self.trident.process_transaction(&[claim], message);

        // Verify invariants
        if !res.is_success() {
            return;
        }
        self.verify_claim_invariants(
            launch,
            funding_record,
            launch_signer,
            base_mint,
            launch_base_vault,
            funder,
            funder_quote_account,
            &pre_launch,
            &pre_funding_record,
            pre_vault_amount,
            pre_funder_token_amount,
        );
    }

    pub fn claim_additional_token_allocation(
        &mut self,
        launch: Pubkey,
        payer: Pubkey,
        launch_signer: Pubkey,
        base_vault: Pubkey,
        base_mint: Pubkey,
        additional_tokens_recipient: Pubkey,
        additional_tokens_recipient_token_account: Pubkey,
        message: Option<&str>,
    ) {
        let event_authority =
            get_event_authority_pda(&mut self.trident, launchpad_v_7::program_id());

        // Capture pre-state for invariants
        let pre_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist before ClaimAdditionalTokenAllocation");
        let pre_base_vault_amount = self
            .trident
            .get_token_account(base_vault)
            .expect("base_vault token account must exist before ClaimAdditionalTokenAllocation")
            .account
            .amount;
        let pre_recipient_amount = self
            .trident
            .get_token_account(additional_tokens_recipient_token_account)
            .map(|acc| acc.account.amount)
            .unwrap_or(0);

        let claim_additional_token_allocation =
            launchpad_v_7::ClaimAdditionalTokenAllocationInstruction::data(
                launchpad_v_7::ClaimAdditionalTokenAllocationInstructionData::new(),
            )
            .accounts(
                launchpad_v_7::ClaimAdditionalTokenAllocationInstructionAccounts::new(
                    launch,
                    payer,
                    launch_signer,
                    base_vault,
                    base_mint,
                    additional_tokens_recipient,
                    additional_tokens_recipient_token_account,
                    SOLANA_PROGRAM_ID,
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID,
                    event_authority,
                    launchpad_v_7::program_id(),
                ),
            )
            .instruction();

        let res = self
            .trident
            .process_transaction(&[claim_additional_token_allocation], message);

        // Verify invariants
        if !res.is_success() {
            return;
        }
        self.verify_claim_additional_token_allocation_invariants(
            launch,
            launch_signer,
            base_vault,
            base_mint,
            additional_tokens_recipient,
            additional_tokens_recipient_token_account,
            &pre_launch,
            pre_base_vault_amount,
            pre_recipient_amount,
        );
    }

    pub fn initialize_performance_package(
        &mut self,
        launch: Pubkey,
        payer: Pubkey,
        launch_signer: Pubkey,
        launch_base_vault: Pubkey,
        base_mint: Pubkey,
        dao: Pubkey,
        squads_multisig: Pubkey,
        squads_multisig_vault: Pubkey,
        performance_package: Pubkey,
        performance_package_token_account: Pubkey,
        message: Option<&str>,
    ) {
        let event_authority =
            get_event_authority_pda(&mut self.trident, launchpad_v_7::program_id());
        let price_based_performance_package_event_authority = get_event_authority_pda(
            &mut self.trident,
            price_based_performance_package::program_id(),
        );

        // Capture pre-state for invariants
        let pre_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist before InitializePerformancePackage");
        let pre_launch_base_vault_amount = self
            .trident
            .get_token_account(launch_base_vault)
            .expect(
                "launch_base_vault token account must exist before InitializePerformancePackage",
            )
            .account
            .amount;
        let pre_pp_vault_amount = self
            .trident
            .get_token_account(performance_package_token_account)
            .map(|acc| acc.account.amount)
            .unwrap_or(0);

        let initialize_performance_package =
            launchpad_v_7::InitializePerformancePackageInstruction::data(
                launchpad_v_7::InitializePerformancePackageInstructionData::new(),
            )
            .accounts(
                launchpad_v_7::InitializePerformancePackageInstructionAccounts::new(
                    launch,
                    payer,
                    launch_signer,
                    launch_base_vault,
                    base_mint,
                    dao,
                    squads_multisig,
                    squads_multisig_vault,
                    performance_package,
                    performance_package_token_account,
                    SOLANA_PROGRAM_ID,
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID,
                    SQUADS_PROGRAM_ID,
                    price_based_performance_package::program_id(),
                    price_based_performance_package_event_authority,
                    event_authority,
                    launchpad_v_7::program_id(),
                ),
            )
            .instruction();

        let res = self
            .trident
            .process_transaction(&[initialize_performance_package], message);

        // Verify invariants
        if !res.is_success() {
            return;
        }
        self.verify_initialize_performance_package_invariants(
            launch,
            launch_signer,
            launch_base_vault,
            base_mint,
            dao,
            squads_multisig_vault,
            performance_package,
            performance_package_token_account,
            &pre_launch,
            pre_launch_base_vault_amount,
            pre_pp_vault_amount,
        );
    }

    pub fn complete_launch(
        &mut self,
        launch: Pubkey,
        launch_authority: Pubkey,
        token_metadata: Pubkey,
        payer: Pubkey,
        launch_signer: Pubkey,
        launch_quote_vault: Pubkey,
        launch_base_vault: Pubkey,
        base_mint: Pubkey,
        quote_mint: Pubkey,
        fee_recipient: Pubkey,
        message: Option<&str>,
    ) {
        let event_authority =
            get_event_authority_pda(&mut self.trident, launchpad_v_7::program_id());
        let autocrat_event_authority =
            get_event_authority_pda(&mut self.trident, futarchy::program_id());
        let bid_wall_event_authority =
            get_event_authority_pda(&mut self.trident, bid_wall::program_id());
        let damm_v2_event_authority =
            get_event_authority_pda(&mut self.trident, DAMM_V2_PROGRAM_ID);
        let squads_program_config = SQUADS_PROGRAM_CONFIG_ID;
        let squads_program_config_treasury = SQUADS_PROGRAM_CONFIG_TREASURY_ID;
        let pool_creator_authority = get_pool_creator_authority_pda(&mut self.trident);
        let pool_authority = get_pool_authority_pda(&mut self.trident);
        let config = METEORA_CONFIG_ID;
        let position_nft_mint = get_position_nft_mint_pda(&mut self.trident, base_mint);
        let pool = get_pool_pda(&mut self.trident, config, base_mint, quote_mint);
        let position_nft_account =
            get_position_nft_account_pda(&mut self.trident, position_nft_mint);
        let position = get_position_pda(&mut self.trident, position_nft_mint);
        let token_a_vault = get_token_a_vault_pda(&mut self.trident, base_mint, pool);
        let token_b_vault = get_token_b_vault_pda(&mut self.trident, quote_mint, pool);
        let dao = get_dao_pda(&mut self.trident, launch_signer, 0);
        let squads_multisig = get_squads_multisig_pda(&mut self.trident, dao);
        let squads_multisig_vault =
            get_squads_multisig_vault_pda(&mut self.trident, squads_multisig);
        let spending_limit =
            get_squads_multisig_spending_limit_pda(&mut self.trident, squads_multisig, dao);
        let treasury_quote_account = get_or_initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            quote_mint,
            squads_multisig_vault,
        );
        let futarchy_amm_base_vault =
            self.trident
                .get_associated_token_address(&base_mint, &dao, &TOKEN_PROGRAM_ID);
        let futarchy_amm_quote_vault =
            self.trident
                .get_associated_token_address(&quote_mint, &dao, &TOKEN_PROGRAM_ID);
        let bid_wall = get_bid_wall_pda(&mut self.trident, base_mint, launch_signer);
        let bid_wall_quote_token_account = get_or_initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            quote_mint,
            bid_wall,
        );
        let dao_owned_lp_position =
            get_amm_position_pda(&mut self.trident, dao, squads_multisig_vault);

        // Capture pre-state for invariants
        let pre_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist before CompleteLaunch");
        let timestamp_before_tx = self.trident.get_current_timestamp();
        let pre_launch_quote_amount = self
            .trident
            .get_token_account(launch_quote_vault)
            .expect("launch_quote_vault must exist before CompleteLaunch")
            .account
            .amount;
        let pre_launch_base_amount = self
            .trident
            .get_token_account(launch_base_vault)
            .expect("launch_base_vault must exist before CompleteLaunch")
            .account
            .amount;
        let pre_treasury_quote_amount = self
            .trident
            .get_token_account(treasury_quote_account)
            .expect("treasury_quote_account must exist before CompleteLaunch")
            .account
            .amount;
        let pre_bid_wall_quote_amount = self
            .trident
            .get_token_account(bid_wall_quote_token_account)
            .expect("bid_wall_quote_token_account must exist before CompleteLaunch")
            .account
            .amount;

        let static_accounts = StaticAccountsInstructionAccounts::new(
            futarchy::program_id(),
            MPL_TOKEN_METADATA_PROGRAM_ID,
            autocrat_event_authority,
            SQUADS_PROGRAM_ID,
            squads_program_config,
            squads_program_config_treasury,
            bid_wall::program_id(),
            bid_wall_event_authority,
        );
        let meteora_accounts = MeteoraAccountsInstructionAccounts::new(
            DAMM_V2_PROGRAM_ID,
            config,
            TOKEN_2022_PROGRAM_ID,
            position_nft_account,
            pool,
            position,
            position_nft_mint,
            base_mint,
            quote_mint,
            token_a_vault,
            token_b_vault,
            pool_creator_authority,
            pool_authority,
            damm_v2_event_authority,
        );
        let complete_launch = launchpad_v_7::CompleteLaunchInstruction::data(
            launchpad_v_7::CompleteLaunchInstructionData::new(),
        )
        .accounts(launchpad_v_7::CompleteLaunchInstructionAccounts::new(
            launch,
            launch_authority,
            token_metadata,
            payer,
            launch_signer,
            launch_quote_vault,
            launch_base_vault,
            treasury_quote_account,
            base_mint,
            quote_mint,
            dao_owned_lp_position,
            futarchy_amm_base_vault,
            futarchy_amm_quote_vault,
            dao,
            squads_multisig,
            squads_multisig_vault,
            spending_limit,
            bid_wall,
            bid_wall_quote_token_account,
            fee_recipient,
            SOLANA_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
            static_accounts,
            meteora_accounts,
            event_authority,
            launchpad_v_7::program_id(),
        ))
        .instruction();

        let request_heap = ComputeBudgetInstruction::request_heap_frame((8 * 32 * 1024) as u32);
        let res = self
            .trident
            .process_transaction(&[request_heap, complete_launch], message);

        if !res.is_success() {
            return;
        }
        self.verify_complete_launch_invariants(
            launch,
            launch_authority,
            dao,
            squads_multisig_vault,
            launch_quote_vault,
            launch_base_vault,
            treasury_quote_account,
            bid_wall_quote_token_account,
            &pre_launch,
            pre_launch_quote_amount,
            pre_launch_base_amount,
            pre_treasury_quote_amount,
            pre_bid_wall_quote_amount,
            timestamp_before_tx,
        );
    }
}
