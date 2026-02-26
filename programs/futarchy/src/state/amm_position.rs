use anchor_lang::prelude::*;

pub const SEED_AMM_POSITION: &[u8] = b"amm_position";

#[account]
#[derive(InitSpace)]
pub struct AmmPosition {
    pub dao: Pubkey,
    pub position_authority: Pubkey,
    pub liquidity: u128,
}
