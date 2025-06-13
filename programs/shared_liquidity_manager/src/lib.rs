//! Enables LPs to provide liquidity that is by default stored in a Raydium
//! constant-product pool, but that can be rented for the purpose of decision
//! markets.
use anchor_lang::prelude::*;

declare_id!("EoJc1PYxZbnCjszampLcwJGYcB5Md47jM4oSQacRtD4d");

mod state;
mod instructions;

use state::SharedLiquidityPool;
use instructions::*;

// TODO:
// - initialize_pool
// - provide_liquidity
// - remove_my_liquidity
// - initialize_proposal_with_liquidity
// - remove_proposal_liquidity

#[program]
pub mod shared_liquidity_manager {
    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>) -> Result<()> {
        InitializePool::handle(ctx)
    }
}
