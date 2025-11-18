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
    /// The amount of USDC that has been committed by the funder.
    pub committed_amount: u64,
    /// Whether the tokens have been claimed.
    pub is_tokens_claimed: bool,
    /// Whether the USDC has been refunded.
    pub is_usdc_refunded: bool,
    /// The amount of USDC that the launch authority has approved for the funder.
    /// If zero, the funder has not been approved for any amount.
    pub approved_amount: u64,
}
