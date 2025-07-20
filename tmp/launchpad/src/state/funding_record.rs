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
    /// The sequence number of this funding record. Useful for sorting events.
    pub seq_num: u64,
}
