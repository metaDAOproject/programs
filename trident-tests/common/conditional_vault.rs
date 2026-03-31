use super::types::conditional_vault::InitializeConditionalVaultInstructionAccounts;
use super::types::conditional_vault::InitializeConditionalVaultInstructionData;
use super::types::conditional_vault::InitializeQuestionArgs;
use super::types::*;

use trident_fuzz::fuzzing::*;

use super::constants::*;

use super::pda;
use super::token;

pub fn initialize_question(
    trident: &mut Trident,
    payer: Pubkey,
    args: InitializeQuestionArgs,
    message: Option<&str>,
) -> Pubkey {
    let question = pda::get_question_pda(trident, args.questionId, args.oracle, args.numOutcomes);

    let event_authority = pda::get_event_authority_pda(trident, conditional_vault::program_id());

    let init_question = conditional_vault::InitializeQuestionInstruction::data(
        conditional_vault::InitializeQuestionInstructionData::new(args),
    )
    .accounts(
        conditional_vault::InitializeQuestionInstructionAccounts::new(
            question,
            payer,
            solana_sdk::system_program::ID,
            event_authority,
            conditional_vault::program_id(),
        ),
    )
    .instruction();

    let res = trident.process_transaction(&[init_question], message);

    invariant!(res.is_success());

    question
}

pub fn initialize_conditional_vault(
    trident: &mut Trident,
    payer: Pubkey,
    question: Pubkey,
    underlying_token_mint: Pubkey,
    message: Option<&str>,
) -> Pubkey {
    let vault = pda::get_conditional_vault_pda(trident, question, underlying_token_mint);

    let event_authority = pda::get_event_authority_pda(trident, conditional_vault::program_id());

    let vault_underlying_token_account =
        token::initialize_associated_token_account(trident, payer, underlying_token_mint, vault);

    let mut remaining_accounts = vec![];

    let question_data = trident
        .get_account_with_type::<conditional_vault::Question>(&question, None)
        .expect("Question not deserialized");

    for x in 0..question_data.payoutNumerators.len() {
        let conditional_token_mint_address =
            pda::get_conditional_token_mint_pda(trident, vault, x as u8);
        remaining_accounts.push(AccountMeta::new(conditional_token_mint_address, false));
    }

    let init_cond_vault = conditional_vault::InitializeConditionalVaultInstruction::data(
        InitializeConditionalVaultInstructionData::new(),
    )
    .accounts(InitializeConditionalVaultInstructionAccounts::new(
        vault,
        question,
        underlying_token_mint,
        vault_underlying_token_account,
        payer,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
        solana_sdk::system_program::ID,
        event_authority,
        conditional_vault::program_id(),
    ))
    .remaining_accounts(remaining_accounts)
    .instruction();

    let res = trident.process_transaction(&[init_cond_vault], message);

    invariant!(res.is_success());

    vault
}

pub fn split_tokens(
    trident: &mut Trident,
    payer: Pubkey,
    question: Pubkey,
    vault: Pubkey,
    amount: u64,
    authority: Pubkey,
    message: Option<&str>,
) {
    let conditional_vault_data = trident
        .get_account_with_type::<conditional_vault::ConditionalVault>(&vault, None)
        .expect("Conditional vault not found");

    let user_underlying_token_account = trident.get_associated_token_address(
        &conditional_vault_data.underlyingTokenMint,
        &authority,
        &TOKEN_PROGRAM_ID,
    );

    let event_authority = pda::get_event_authority_pda(trident, conditional_vault::program_id());

    let mut conditional_token_accounts = vec![];

    for pubkey in &conditional_vault_data.conditionalTokenMints {
        conditional_token_accounts.push(AccountMeta::new(*pubkey, false));
    }

    for pubkey in &conditional_vault_data.conditionalTokenMints {
        let conditional_token_user_ata =
            token::initialize_associated_token_account(trident, payer, *pubkey, authority);

        conditional_token_accounts.push(AccountMeta::new(conditional_token_user_ata, false));
    }

    let split_ix = conditional_vault::SplitTokensInstruction::data(
        conditional_vault::SplitTokensInstructionData::new(amount),
    )
    .accounts(conditional_vault::SplitTokensInstructionAccounts::new(
        question,
        vault,
        conditional_vault_data.underlyingTokenAccount,
        authority,
        user_underlying_token_account,
        TOKEN_PROGRAM_ID,
        event_authority,
        conditional_vault::program_id(),
    ))
    .remaining_accounts(conditional_token_accounts)
    .instruction();

    let res = trident.process_transaction(&[split_ix], message);

    invariant!(res.is_success());
}

pub fn merge_tokens(
    trident: &mut Trident,
    question: Pubkey,
    vault: Pubkey,
    amount: u64,
    authority: Pubkey,
    message: Option<&str>,
) {
    let conditional_vault_data = trident
        .get_account_with_type::<conditional_vault::ConditionalVault>(&vault, None)
        .expect("Conditional vault not found");

    let user_underlying_token_account = trident.get_associated_token_address(
        &conditional_vault_data.underlyingTokenMint,
        &authority,
        &TOKEN_PROGRAM_ID,
    );

    let event_authority = pda::get_event_authority_pda(trident, conditional_vault::program_id());

    let mut conditional_token_accounts = vec![];

    for pubkey in &conditional_vault_data.conditionalTokenMints {
        conditional_token_accounts.push(AccountMeta::new(*pubkey, false));
    }

    for pubkey in &conditional_vault_data.conditionalTokenMints {
        let conditional_token_user_ata =
            token::initialize_associated_token_account(trident, authority, *pubkey, authority);

        conditional_token_accounts.push(AccountMeta::new(conditional_token_user_ata, false));
    }

    let merge_ix = conditional_vault::MergeTokensInstruction::data(
        conditional_vault::MergeTokensInstructionData::new(amount),
    )
    .accounts(conditional_vault::MergeTokensInstructionAccounts::new(
        question,
        vault,
        conditional_vault_data.underlyingTokenAccount,
        authority,
        user_underlying_token_account,
        TOKEN_PROGRAM_ID,
        event_authority,
        conditional_vault::program_id(),
    ))
    .remaining_accounts(conditional_token_accounts)
    .instruction();

    let res = trident.process_transaction(&[merge_ix], message);

    invariant!(res.is_success());
}
