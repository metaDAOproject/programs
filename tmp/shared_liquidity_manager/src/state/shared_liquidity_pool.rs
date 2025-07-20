use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct SharedLiquidityPool {
    /// The PDA bump.
    pub pda_bump: u8,
    /// The DAO.
    pub dao: Pubkey,
    /// The base mint.
    pub base_mint: Pubkey,
    /// The quote mint.
    pub quote_mint: Pubkey,
    /// The signer of this pool, used because Raydium pools need a SOL payer and this PDA can't hold SOL.
    pub sl_pool_signer: Pubkey,
    /// The pda bump of the signer.
    pub sl_pool_signer_bump: u8,
    /// Holds the base tokens for the shared liquidity pool when it's moving liquidity around.
    pub sl_pool_base_vault: Pubkey,
    /// Holds the quote tokens for the shared liquidity pool when it's moving liquidity around.
    pub sl_pool_quote_vault: Pubkey,
    /// Holds the LP tokens for the shared liquidity pool.
    pub sl_pool_spot_lp_vault: Pubkey,
    /// The proposal that's using liquidity from this pool.
    pub active_proposal: Option<Pubkey>,
    /// The percentage of a token's supply, in basis points, that needs to be
    /// staked to a draft proposal before it can be initialized.
    pub proposal_stake_rate_threshold_bps: u16,
    /// The sequence number of this shared liquidity pool. Useful for sorting events.
    pub seq_num: u64,
    /// The current Raydium spot pool. Changes when a proposal is removed.
    pub active_spot_pool: Pubkey,
    /// The index of the current Raydium spot pool. Starts at 0 and increments by 1 for each new spot pool.
    pub active_spot_pool_index: u32,
    /// Whether the base token is token0 in the current Raydium spot pool (otherwise it's token1).
    pub is_base_token_0: bool,
}
