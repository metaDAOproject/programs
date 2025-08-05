use anchor_lang::prelude::*;

#[event]
pub struct SwapExecuted {
    pub user: Pubkey,
    pub token_converter: Pubkey,
    pub inbound_token_mint: Pubkey,
    pub outbound_token_mint: Pubkey,
    pub inbound_amount: u64,
    pub outbound_amount: u64,
    pub burned: bool,
    pub timestamp: i64,
}