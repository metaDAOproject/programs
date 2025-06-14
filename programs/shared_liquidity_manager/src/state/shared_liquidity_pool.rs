use anchor_lang::prelude::*;

#[account]
pub struct SharedLiquidityPool {
    /// The PDA bump.
    pub pda_bump: u8,
    /// The Raydium spot pool state.
    pub spot_pool_state: Pubkey,
    /// The DAO.
    pub dao: Pubkey,
    /// Whether there's an active proposal using liquidity from this pool.
    pub is_active_proposal: bool,
    /// The sequence number of this shared liquidity pool. Useful for sorting events.
    pub seq_num: u64,
    /// Holds the Raydium LP tokens for this pool.
    pub lp_token_vault: Pubkey,
    /// Holds the token0s for this pool.
    pub token_0_vault: Pubkey,
    /// Holds the token1s for this pool.
    pub token_1_vault: Pubkey,
}
