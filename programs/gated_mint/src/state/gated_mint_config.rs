use anchor_lang::prelude::*;

pub const GATED_MINT_CONFIG_SEED: &[u8] = b"gated_mint_config";

#[account]
#[derive(InitSpace)]
pub struct GatedMintConfig {
    pub mint: Pubkey,
    pub admin: Pubkey,
    pub gating_disabled: bool,
    pub seq_num: u64,
    pub bump: u8,
}
