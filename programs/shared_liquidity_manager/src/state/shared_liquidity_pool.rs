use anchor_lang::prelude::*;

#[account]
pub struct SharedLiquidityPool {
    /// The DAO.
    pub dao: Pubkey,
    /// The base mint.
    pub base_mint: Pubkey,
    /// The quote mint.
    pub quote_mint: Pubkey,
    /// The Raydium spot pool state.
    pub spot_pool: Pubkey,
    /// Whether the base token is token0 in the Raydium spot pool (otherwise it's token1).
    pub is_base_token_0: bool,
    /// Whether there's an active proposal using liquidity from this pool.
    pub active_proposal: Option<Pubkey>,
    /// Holds the Raydium LP tokens for the shared liquidity pool.
    pub sl_pool_spot_lp_vault: Pubkey,
    /// Holds the base tokens for the shared liquidity pool when it's moving liquidity to/from proposals.
    pub sl_pool_base_vault: Pubkey,
    /// Holds the quote tokens for the shared liquidity pool when it's moving liquidity to/from proposals.
    pub sl_pool_quote_vault: Pubkey,
    /// The sequence number of this shared liquidity pool. Useful for sorting events.
    pub seq_num: u64,
    /// The PDA bump.
    pub pda_bump: u8,
}
