use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct AmmPosition {
    pub dao: Pubkey,
    pub position_authority: Pubkey,
    pub liquidity: u128,
}
