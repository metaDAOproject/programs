use anchor_lang::prelude::*;

#[account]
pub struct LiquidityPosition {
    /// The owner of this position
    pub owner: Pubkey,
    /// The shared liquidity pool this position belongs to
    pub pool: Pubkey,
    /// The amount of underlying spot LP shares this position represents
    pub underlying_spot_lp_shares: u64,
    /// The PDA bump
    pub bump: u8,
} 