use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct MintAuthority {
    pub mint_governor: Pubkey,
    pub authorized_minter: Pubkey,
    pub max_total: Option<u64>,
    pub total_minted: u64,
    pub bump: u8,
}
