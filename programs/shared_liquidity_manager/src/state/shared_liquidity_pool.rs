use anchor_lang::prelude::*;

#[account]
pub struct SharedLiquidityPool {
    /// The PDA bump.
    pub pda_bump: u8,
    /// The Raydium spot pool state.
    pub spot_pool_state: Pubkey,
    /// The DAO.
    pub dao: Pubkey,
    /// The sequence number of this shared liquidity pool. Useful for sorting events.
    pub seq_num: u64,
}
