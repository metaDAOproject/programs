use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct AmmPosition {
    pub futarchy_amm: Pubkey,
    pub liquidity_provider: Pubkey,
    pub liquidity: u128,
}