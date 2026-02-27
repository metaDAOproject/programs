use super::types::futarchy::SpotSwapInstructionAccounts;
use super::types::futarchy::SpotSwapInstructionData;
use super::types::futarchy::StakeToProposalInstructionAccounts;
use super::types::futarchy::StakeToProposalInstructionData;
use super::types::*;

use trident_fuzz::fuzzing::*;
use trident_fuzz::trident::transaction_result::TransactionResult;

use super::constants::*;
use super::types::futarchy::InitializeDaoParams;

use super::pda;
use super::token;

/// Standalone futarchy helper functions that work with Trident directly
pub fn initialize_dao(
    trident: &mut Trident,
    payer: Pubkey,
    dao_creator: Pubkey,
    base_mint: Pubkey,
    quote_mint: Pubkey,
    init_dao_params: InitializeDaoParams,
    message: Option<&str>,
) -> (Pubkey, Pubkey) {
    let dao = pda::get_dao_pda(trident, dao_creator, init_dao_params.nonce);
    let squads_multisig = pda::get_squads_multisig_pda(trident, dao);

    let squads_multisig_vault = pda::get_squads_multisig_vault_pda(trident, squads_multisig);

    let spending_limit = pda::get_squads_multisig_spending_limit_pda(trident, squads_multisig, dao);

    let futarchy_amm_base_vault =
        trident.get_associated_token_address(&base_mint, &dao, &TOKEN_PROGRAM_ID);

    let futarchy_amm_quote_vault =
        trident.get_associated_token_address(&quote_mint, &dao, &TOKEN_PROGRAM_ID);

    let event_authority = pda::get_event_authority_pda(trident, futarchy::program_id());

    let init_dao = futarchy::InitializeDaoInstruction::data(
        futarchy::InitializeDaoInstructionData::new(init_dao_params),
    )
    .accounts(futarchy::InitializeDaoInstructionAccounts::new(
        dao,
        dao_creator,
        payer,
        solana_sdk::system_program::ID,
        base_mint,
        quote_mint,
        squads_multisig,
        squads_multisig_vault,
        SQUADS_PROGRAM_ID,
        SQUADS_PROGRAM_CONFIG_ID,
        SQUADS_PROGRAM_CONFIG_TREASURY_ID,
        spending_limit,
        futarchy_amm_base_vault,
        futarchy_amm_quote_vault,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
        event_authority,
        futarchy::program_id(),
    ))
    .instruction();

    let res = trident.process_transaction(&[init_dao], message);

    assert!(res.is_success());

    (dao, squads_multisig)
}

#[allow(clippy::too_many_arguments)]
pub fn initialize_proposal(
    trident: &mut Trident,
    dao: Pubkey,
    squads_proposal: Pubkey,
    squads_multisig: Pubkey,
    proposer: Pubkey,
    payer: Pubkey,
    question: Pubkey,
    base_vault: Pubkey,
    quote_vault: Pubkey,
    message: Option<&str>,
) -> Pubkey {
    let proposal = pda::get_proposal_pda(trident, squads_proposal);

    let event_authority = pda::get_event_authority_pda(trident, futarchy::program_id());

    let init_prop = futarchy::InitializeProposalInstruction::data(
        futarchy::InitializeProposalInstructionData::new(),
    )
    .accounts(futarchy::InitializeProposalInstructionAccounts::new(
        proposal,
        squads_proposal,
        squads_multisig,
        dao,
        question,
        quote_vault,
        base_vault,
        proposer,
        payer,
        solana_sdk::system_program::ID,
        event_authority,
        futarchy::program_id(),
    ))
    .instruction();

    let res = trident.process_transaction(&[init_prop], message);

    assert!(res.is_success());

    proposal
}

#[allow(clippy::too_many_arguments)]
pub fn stake_to_proposal(
    trident: &mut Trident,
    dao: Pubkey,
    payer: Pubkey,
    proposal: Pubkey,
    staker: Pubkey,
    proposal_base_account: Pubkey,
    params: futarchy::StakeToProposalParams,
    message: Option<&str>,
) {
    let dao_data = trident
        .get_account_with_type::<futarchy::Dao>(&dao, None)
        .expect("Dao not found");

    let event_authority = pda::get_event_authority_pda(trident, futarchy::program_id());

    let stake_account = pda::get_stake_account_pda(trident, proposal, staker);

    let staker_base_ata =
        trident.get_associated_token_address(&dao_data.baseMint, &staker, &TOKEN_PROGRAM_ID);

    let stake_to_proposal_ix =
        futarchy::StakeToProposalInstruction::data(StakeToProposalInstructionData::new(params))
            .accounts(StakeToProposalInstructionAccounts::new(
                proposal,
                dao,
                staker_base_ata,
                proposal_base_account,
                stake_account,
                staker,
                payer,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID,
                solana_sdk::system_program::ID,
                event_authority,
                futarchy::program_id(),
            ))
            .instruction();

    let res = trident.process_transaction(&[stake_to_proposal_ix], message);

    assert!(res.is_success());
}

#[allow(clippy::too_many_arguments)]
pub fn launch_proposal(
    trident: &mut Trident,
    squads_multisig: Pubkey,
    squads_proposal: Pubkey,
    dao: Pubkey,
    payer: Pubkey,
    proposal: Pubkey,
    base_vault: Pubkey,
    quote_vault: Pubkey,
    message: Option<&str>,
) {
    let base_vault_data = trident
        .get_account_with_type::<conditional_vault::ConditionalVault>(&base_vault, None)
        .expect("Base conditional vault not found");

    let quote_vault_data = trident
        .get_account_with_type::<conditional_vault::ConditionalVault>(&quote_vault, None)
        .expect("Quote conditional vault not found");

    let pass_base_mint = base_vault_data.conditionalTokenMints[1];
    let pass_quote_mint = quote_vault_data.conditionalTokenMints[1];
    let fail_base_mint = base_vault_data.conditionalTokenMints[0];
    let fail_quote_mint = quote_vault_data.conditionalTokenMints[0];

    let amm_pass_base_vault =
        trident.get_associated_token_address(&pass_base_mint, &dao, &TOKEN_PROGRAM_ID);
    let amm_pass_quote_vault =
        trident.get_associated_token_address(&pass_quote_mint, &dao, &TOKEN_PROGRAM_ID);
    let amm_fail_base_vault =
        trident.get_associated_token_address(&fail_base_mint, &dao, &TOKEN_PROGRAM_ID);
    let amm_fail_quote_vault =
        trident.get_associated_token_address(&fail_quote_mint, &dao, &TOKEN_PROGRAM_ID);

    let event_authority = pda::get_event_authority_pda(trident, futarchy::program_id());

    let launch_ix =
        futarchy::LaunchProposalInstruction::data(futarchy::LaunchProposalInstructionData::new())
            .accounts(futarchy::LaunchProposalInstructionAccounts::new(
                proposal,
                base_vault,
                quote_vault,
                pass_base_mint,
                pass_quote_mint,
                fail_base_mint,
                fail_quote_mint,
                dao,
                payer,
                amm_pass_base_vault,
                amm_pass_quote_vault,
                amm_fail_base_vault,
                amm_fail_quote_vault,
                squads_multisig,
                squads_proposal,
                solana_sdk::system_program::ID,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID,
                event_authority,
                futarchy::program_id(),
            ))
            .instruction();

    let res = trident.process_transaction(&[launch_ix], message);

    assert!(res.is_success());
}

pub fn spot_swap(
    trident: &mut Trident,
    dao: Pubkey,
    user: Pubkey,
    params: futarchy::SpotSwapParams,
    message: Option<&str>,
) -> TransactionResult {
    let dao_data = trident
        .get_account_with_type::<futarchy::Dao>(&dao, None)
        .expect("Dao not found");

    let user_base_account =
        trident.get_associated_token_address(&dao_data.baseMint, &user, &TOKEN_PROGRAM_ID);

    let user_quote_account =
        trident.get_associated_token_address(&dao_data.quoteMint, &user, &TOKEN_PROGRAM_ID);

    let amm_base_vault =
        trident.get_associated_token_address(&dao_data.baseMint, &dao, &TOKEN_PROGRAM_ID);

    let amm_quote_vault =
        trident.get_associated_token_address(&dao_data.quoteMint, &dao, &TOKEN_PROGRAM_ID);

    let event_authority = pda::get_event_authority_pda(trident, futarchy::program_id());
    let spot_swap_ix = futarchy::SpotSwapInstruction::data(SpotSwapInstructionData::new(params))
        .accounts(SpotSwapInstructionAccounts::new(
            dao,
            user_base_account,
            user_quote_account,
            amm_base_vault,
            amm_quote_vault,
            user,
            TOKEN_PROGRAM_ID,
            event_authority,
            futarchy::program_id(),
        ))
        .instruction();

    trident.process_transaction(&[spot_swap_ix], message)
}

pub fn add_liqidity(
    trident: &mut Trident,
    dao: Pubkey,
    payer: Pubkey,
    liquidity_provider: Pubkey,
    params: futarchy::ProvideLiquidityParams,
    message: Option<&str>,
) -> TransactionResult {
    let dao_data = trident
        .get_account_with_type::<futarchy::Dao>(&dao, None)
        .expect("Dao not found");

    let liquidity_provider_base_account = trident.get_associated_token_address(
        &dao_data.baseMint,
        &liquidity_provider,
        &TOKEN_PROGRAM_ID,
    );
    let liquidity_provider_quote_account = trident.get_associated_token_address(
        &dao_data.quoteMint,
        &liquidity_provider,
        &TOKEN_PROGRAM_ID,
    );

    let amm_base_vault =
        trident.get_associated_token_address(&dao_data.baseMint, &dao, &TOKEN_PROGRAM_ID);

    let amm_quote_vault =
        trident.get_associated_token_address(&dao_data.quoteMint, &dao, &TOKEN_PROGRAM_ID);

    let amm_position = pda::get_amm_position_pda(trident, dao, liquidity_provider);

    let event_authority = pda::get_event_authority_pda(trident, futarchy::program_id());

    let add_liq = futarchy::ProvideLiquidityInstruction::data(
        futarchy::ProvideLiquidityInstructionData::new(params),
    )
    .accounts(futarchy::ProvideLiquidityInstructionAccounts::new(
        dao,
        liquidity_provider,
        liquidity_provider_base_account,
        liquidity_provider_quote_account,
        payer,
        solana_sdk::system_program::ID,
        amm_base_vault,
        amm_quote_vault,
        amm_position,
        TOKEN_PROGRAM_ID,
        event_authority,
        futarchy::program_id(),
    ))
    .instruction();

    trident.process_transaction(&[add_liq], message)
}

pub fn withdraw_liquidity(
    trident: &mut Trident,
    dao: Pubkey,
    payer: Pubkey,
    liquidity_provider: Pubkey,
    params: futarchy::WithdrawLiquidityParams,
    message: Option<&str>,
) -> TransactionResult {
    let dao_data = trident
        .get_account_with_type::<futarchy::Dao>(&dao, None)
        .expect("Dao not found");

    let liquidity_provider_base_account = token::initialize_associated_token_account(
        trident,
        payer,
        dao_data.baseMint,
        liquidity_provider,
    );

    let liquidity_provider_quote_account = token::initialize_associated_token_account(
        trident,
        payer,
        dao_data.quoteMint,
        liquidity_provider,
    );

    let amm_base_vault =
        trident.get_associated_token_address(&dao_data.baseMint, &dao, &TOKEN_PROGRAM_ID);

    let amm_quote_vault =
        trident.get_associated_token_address(&dao_data.quoteMint, &dao, &TOKEN_PROGRAM_ID);

    let amm_position = pda::get_amm_position_pda(trident, dao, liquidity_provider);

    let amm_position_data = trident
        .get_account_with_type::<futarchy::AmmPosition>(&amm_position, None)
        .expect("Amm position not found");

    let position_authority = amm_position_data.positionAuthority;

    let event_authority = pda::get_event_authority_pda(trident, futarchy::program_id());

    let withdraw_ix = futarchy::WithdrawLiquidityInstruction::data(
        futarchy::WithdrawLiquidityInstructionData::new(params),
    )
    .accounts(futarchy::WithdrawLiquidityInstructionAccounts::new(
        dao,
        position_authority,
        liquidity_provider_base_account,
        liquidity_provider_quote_account,
        amm_base_vault,
        amm_quote_vault,
        amm_position,
        TOKEN_PROGRAM_ID,
        event_authority,
        futarchy::program_id(),
    ))
    .instruction();

    trident.process_transaction(&[withdraw_ix], message)
}

#[allow(clippy::too_many_arguments)]
pub fn conditional_swap(
    trident: &mut Trident,
    dao: Pubkey,
    payer: Pubkey,
    proposal: Pubkey,
    trader: Pubkey,
    question: Pubkey,
    base_vault: Pubkey,
    quote_vault: Pubkey,
    params: futarchy::ConditionalSwapParams,
    message: Option<&str>,
) -> TransactionResult {
    let dao_data = trident
        .get_account_with_type::<futarchy::Dao>(&dao, None)
        .expect("Dao not found");

    let base_vault_data = trident
        .get_account_with_type::<conditional_vault::ConditionalVault>(&base_vault, None)
        .expect("Base conditional vault not found");

    let quote_vault_data = trident
        .get_account_with_type::<conditional_vault::ConditionalVault>(&quote_vault, None)
        .expect("Quote conditional vault not found");

    let amm_base_vault =
        trident.get_associated_token_address(&dao_data.baseMint, &dao, &TOKEN_PROGRAM_ID);

    let amm_quote_vault =
        trident.get_associated_token_address(&dao_data.quoteMint, &dao, &TOKEN_PROGRAM_ID);

    let pass_base_mint = base_vault_data.conditionalTokenMints[1];
    let pass_quote_mint = quote_vault_data.conditionalTokenMints[1];
    let fail_base_mint = base_vault_data.conditionalTokenMints[0];
    let fail_quote_mint = quote_vault_data.conditionalTokenMints[0];

    let amm_pass_base_vault =
        trident.get_associated_token_address(&pass_base_mint, &dao, &TOKEN_PROGRAM_ID);
    let amm_pass_quote_vault =
        trident.get_associated_token_address(&pass_quote_mint, &dao, &TOKEN_PROGRAM_ID);
    let amm_fail_base_vault =
        trident.get_associated_token_address(&fail_base_mint, &dao, &TOKEN_PROGRAM_ID);
    let amm_fail_quote_vault =
        trident.get_associated_token_address(&fail_quote_mint, &dao, &TOKEN_PROGRAM_ID);

    let (user_input_account, user_output_account) = evaluate_conditional_swap_token_accounts(
        trident,
        payer,
        trader,
        fail_base_mint,
        pass_base_mint,
        fail_quote_mint,
        pass_quote_mint,
        &params,
    );

    let event_authority = pda::get_event_authority_pda(trident, futarchy::program_id());

    let conditional_vault_event_authority =
        pda::get_event_authority_pda(trident, conditional_vault::program_id());

    let conditional_swap = futarchy::ConditionalSwapInstruction::data(
        futarchy::ConditionalSwapInstructionData::new(params),
    )
    .accounts(futarchy::ConditionalSwapInstructionAccounts::new(
        dao,
        amm_base_vault,
        amm_quote_vault,
        proposal,
        amm_pass_base_vault,
        amm_pass_quote_vault,
        amm_fail_base_vault,
        amm_fail_quote_vault,
        trader,
        user_input_account,
        user_output_account,
        base_vault,
        base_vault_data.underlyingTokenAccount,
        quote_vault,
        quote_vault_data.underlyingTokenAccount,
        pass_base_mint,
        fail_base_mint,
        pass_quote_mint,
        fail_quote_mint,
        conditional_vault::program_id(),
        conditional_vault_event_authority,
        question,
        TOKEN_PROGRAM_ID,
        event_authority,
        futarchy::program_id(),
    ))
    .instruction();

    trident.process_transaction(&[conditional_swap], message)
}

#[allow(clippy::too_many_arguments)]
pub fn finalize_proposal(
    trident: &mut Trident,
    dao: Pubkey,
    proposal: Pubkey,
    question: Pubkey,
    base_vault: Pubkey,
    quote_vault: Pubkey,
    message: Option<&str>,
) -> TransactionResult {
    let dao_data = trident
        .get_account_with_type::<futarchy::Dao>(&dao, None)
        .expect("Dao not found");
    let proposal_data = trident
        .get_account_with_type::<futarchy::Proposal>(&proposal, None)
        .expect("Proposal not found");
    let base_vault_data = trident
        .get_account_with_type::<conditional_vault::ConditionalVault>(&base_vault, None)
        .expect("Base conditional vault not found");
    let quote_vault_data = trident
        .get_account_with_type::<conditional_vault::ConditionalVault>(&quote_vault, None)
        .expect("Quote conditional vault not found");

    let amm_base_vault =
        trident.get_associated_token_address(&dao_data.baseMint, &dao, &TOKEN_PROGRAM_ID);
    let amm_quote_vault =
        trident.get_associated_token_address(&dao_data.quoteMint, &dao, &TOKEN_PROGRAM_ID);

    let pass_base_mint = proposal_data.passBaseMint;
    let pass_quote_mint = proposal_data.passQuoteMint;
    let fail_base_mint = proposal_data.failBaseMint;
    let fail_quote_mint = proposal_data.failQuoteMint;

    let amm_pass_base_vault =
        trident.get_associated_token_address(&pass_base_mint, &dao, &TOKEN_PROGRAM_ID);
    let amm_pass_quote_vault =
        trident.get_associated_token_address(&pass_quote_mint, &dao, &TOKEN_PROGRAM_ID);
    let amm_fail_base_vault =
        trident.get_associated_token_address(&fail_base_mint, &dao, &TOKEN_PROGRAM_ID);
    let amm_fail_quote_vault =
        trident.get_associated_token_address(&fail_quote_mint, &dao, &TOKEN_PROGRAM_ID);

    let event_authority = pda::get_event_authority_pda(trident, futarchy::program_id());
    let vault_event_authority =
        pda::get_event_authority_pda(trident, conditional_vault::program_id());

    let finalize_ix = futarchy::FinalizeProposalInstruction::data(
        futarchy::FinalizeProposalInstructionData::new(),
    )
    .accounts(futarchy::FinalizeProposalInstructionAccounts::new(
        proposal,
        dao,
        question,
        proposal_data.squadsProposal,
        dao_data.squadsMultisig,
        SQUADS_PROGRAM_ID,
        amm_pass_base_vault,
        amm_pass_quote_vault,
        amm_fail_base_vault,
        amm_fail_quote_vault,
        amm_base_vault,
        amm_quote_vault,
        conditional_vault::program_id(),
        vault_event_authority,
        TOKEN_PROGRAM_ID,
        quote_vault,
        quote_vault_data.underlyingTokenAccount,
        pass_quote_mint,
        fail_quote_mint,
        pass_base_mint,
        fail_base_mint,
        base_vault,
        base_vault_data.underlyingTokenAccount,
        event_authority,
        futarchy::program_id(),
    ))
    .instruction();

    trident.process_transaction(&[finalize_ix], message)
}

#[allow(clippy::too_many_arguments)]
fn evaluate_conditional_swap_token_accounts(
    trident: &mut Trident,
    payer: Pubkey,
    user: Pubkey,
    base_fail_mint: Pubkey,
    base_pass_mint: Pubkey,
    quote_fail_mint: Pubkey,
    quote_pass_mint: Pubkey,
    params: &futarchy::ConditionalSwapParams,
) -> (Pubkey, Pubkey) {
    match (&params.swapType, &params.market) {
        (futarchy::SwapType::Buy, futarchy::Market::Pass) => {
            let user_in =
                trident.get_associated_token_address(&quote_pass_mint, &user, &TOKEN_PROGRAM_ID);
            let user_out =
                trident.get_associated_token_address(&base_pass_mint, &user, &TOKEN_PROGRAM_ID);

            match trident.get_token_account(user_out) {
                Ok(_) => (user_in, user_out),
                Err(_) => {
                    let init_ata = token::initialize_associated_token_account(
                        trident,
                        payer,
                        base_pass_mint,
                        user,
                    );
                    (user_in, init_ata)
                }
            }
        }
        (futarchy::SwapType::Buy, futarchy::Market::Fail) => {
            let user_in =
                trident.get_associated_token_address(&quote_fail_mint, &user, &TOKEN_PROGRAM_ID);
            let user_out =
                trident.get_associated_token_address(&base_fail_mint, &user, &TOKEN_PROGRAM_ID);
            match trident.get_token_account(user_out) {
                Ok(_) => (user_in, user_out),
                Err(_) => {
                    let init_ata = token::initialize_associated_token_account(
                        trident,
                        payer,
                        base_fail_mint,
                        user,
                    );
                    (user_in, init_ata)
                }
            }
        }
        (futarchy::SwapType::Sell, futarchy::Market::Pass) => {
            let user_in =
                trident.get_associated_token_address(&base_pass_mint, &user, &TOKEN_PROGRAM_ID);
            let user_out =
                trident.get_associated_token_address(&quote_pass_mint, &user, &TOKEN_PROGRAM_ID);
            match trident.get_token_account(user_out) {
                Ok(_) => (user_in, user_out),
                Err(_) => {
                    let init_ata = token::initialize_associated_token_account(
                        trident,
                        payer,
                        quote_pass_mint,
                        user,
                    );
                    (user_in, init_ata)
                }
            }
        }
        (futarchy::SwapType::Sell, futarchy::Market::Fail) => {
            let user_in =
                trident.get_associated_token_address(&base_fail_mint, &user, &TOKEN_PROGRAM_ID);
            let user_out =
                trident.get_associated_token_address(&quote_fail_mint, &user, &TOKEN_PROGRAM_ID);
            match trident.get_token_account(user_out) {
                Ok(_) => (user_in, user_out),
                Err(_) => {
                    let init_ata = token::initialize_associated_token_account(
                        trident,
                        payer,
                        quote_fail_mint,
                        user,
                    );
                    (user_in, init_ata)
                }
            }
        }
        (_, _) => panic!("Conditional Swap does not support Spot swaps"),
    }
}
