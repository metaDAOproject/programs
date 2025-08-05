use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct TokenConverter {
    pub authority: Pubkey,
    pub inbound_token_mint: Pubkey,
    pub outbound_token_mint: Pubkey,
    pub inbound_token_vault: Pubkey,
    pub outbound_token_vault: Pubkey,
    pub inbound_token_decimals: u8,
    pub outbound_token_decimals: u8,
    pub conversion_ratio: u64, 
    pub burn_inbound_token: bool,
    pub nonce: u64, 
    pub bump: u8,
}