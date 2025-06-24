use anchor_lang::prelude::*;

#[account]
pub struct StakeRecord {
    pub staker: Pubkey,
    pub amount: u64,
}
