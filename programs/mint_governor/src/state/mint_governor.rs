use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct MintGovernor {
    pub mint: Pubkey,
    pub admin: Pubkey,
    pub create_key: Pubkey,
    pub seq_num: u64,
    pub bump: u8,
}
