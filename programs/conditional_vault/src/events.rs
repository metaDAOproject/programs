use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
}

impl CommonFields {
    pub fn new(clock: &Clock) -> Self {
        Self {
            slot: clock.slot,
            unix_timestamp: clock.unix_timestamp,
        }
    }
}

#[event]
pub struct AddMetadataToConditionalTokensEvent {
    pub common: CommonFields,
    pub vault: Pubkey,
    pub conditional_token_mint: Pubkey,
    pub conditional_token_metadata: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub seq_num: u64,
}

// TODO add `vault` to this event
#[event]
pub struct InitializeConditionalVaultEvent {
    pub common: CommonFields,
    pub vault: Pubkey,
    pub question: Pubkey,
    pub underlying_token_mint: Pubkey,
    pub vault_underlying_token_account: Pubkey,
    pub conditional_token_mints: Vec<Pubkey>,
    pub pda_bump: u8,
    pub seq_num: u64,
}

#[event]
pub struct InitializeQuestionEvent {
    pub common: CommonFields,
    pub question_id: [u8; 32],
    pub oracle: Pubkey,
    pub num_outcomes: u8,
    pub question: Pubkey,
}

#[event]
pub struct MergeTokensEvent {
    pub common: CommonFields,
    pub user: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
    pub post_user_underlying_balance: u64,
    pub post_vault_underlying_balance: u64,
    pub post_user_conditional_token_balances: Vec<u64>,
    pub post_conditional_token_supplies: Vec<u64>,
    pub seq_num: u64,
}

#[event]
pub struct RedeemTokensEvent {
    pub common: CommonFields,
    pub user: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
    pub post_user_underlying_balance: u64,
    pub post_vault_underlying_balance: u64,
    pub post_conditional_token_supplies: Vec<u64>,
    pub seq_num: u64,
}

#[event]
pub struct ResolveQuestionEvent {
    pub common: CommonFields,
    pub question: Pubkey,
    pub payout_numerators: Vec<u32>,
}

#[event]
pub struct SplitTokensEvent {
    pub common: CommonFields,
    pub user: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
    pub post_user_underlying_balance: u64,
    pub post_vault_underlying_balance: u64,
    pub post_user_conditional_token_balances: Vec<u64>,
    pub post_conditional_token_supplies: Vec<u64>,
    pub seq_num: u64,
}
