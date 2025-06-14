//! Enables LPs to provide liquidity that is by default stored in a Raydium
//! constant-product pool, but that can be rented for the purpose of decision
//! markets.
use anchor_lang::prelude::*;

declare_id!("EoJc1PYxZbnCjszampLcwJGYcB5Md47jM4oSQacRtD4d");


mod state;
mod instructions;

use instructions::*;

// TODO:
// - add a proposer fee
// - implement withdraw
// - implement remove_proposal_liquidity
// - add a proposal instruction

#[program]
pub mod shared_liquidity_manager {
    use super::*;

    pub fn initialize_shared_liquidity_pool(ctx: Context<InitializeSharedLiquidityPool>) -> Result<()> {
        InitializeSharedLiquidityPool::handle(ctx)
    }

    pub fn deposit_shared_liquidity(ctx: Context<DepositSharedLiquidity>, params: DepositSharedLiquidityParams) -> Result<()> {
        DepositSharedLiquidity::handle(ctx, params)
    }

    pub fn withdraw_shared_liquidity(ctx: Context<WithdrawSharedLiquidity>) -> Result<()> {
        WithdrawSharedLiquidity::handle(ctx)
    }

    pub fn initialize_proposal_with_liquidity(ctx: Context<InitializeProposalWithLiquidity>, params: InitializeProposalWithLiquidityParams) -> Result<()> {
        InitializeProposalWithLiquidity::handle(ctx, params)
    }

    pub fn remove_proposal_liquidity(ctx: Context<RemoveProposalLiquidity>) -> Result<()> {
        RemoveProposalLiquidity::handle(ctx)
    }
}
