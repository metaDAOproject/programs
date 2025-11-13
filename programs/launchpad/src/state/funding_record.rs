use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct FundingRecord {
    /// The PDA bump.
    pub pda_bump: u8,
    /// The funder.
    pub funder: Pubkey,
    /// The launch.
    pub launch: Pubkey,
    /// The amount of USDC (including fees) that has been committed by the funder.
    pub committed_amount: u64,
    /// Whether the tokens have been claimed.
    pub is_tokens_claimed: bool,
    /// Whether the USDC has been refunded.
    pub is_usdc_refunded: bool,
}
