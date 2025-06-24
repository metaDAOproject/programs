//! Enables LPs to provide liquidity that is by default stored in a Raydium
//! constant-product pool, but that can be rented for the purpose of decision
//! markets.
//! 
//! How it works:
//! - A DAO creates a shared liquidity pool with some protocol-owned-liquidity and
//!   sets the % of the token supply that needs to be staked on a proposal for it
//!   to go to a DAO proposal. By default, all the liquidity is in a Raydium spot pool.
//! - Anyone can create draft proposals.
//! - Anyone can stake/unstake their DAO tokens on draft proposals.
//! - When a proposal receives enough staked DAO tokens, anyone can call
//!   `initialize_proposal_with_liquidity` to initialize the proposal with the
//!   shared liquidity pool. While this proposal is active, noone else can initialize
//!   proposals through this shared liquidity pool.
//! - When a proposal is finalized, anyone can call `remove_proposal_liquidity` to
//!   remove the liquidity from both the proposal and the current Raydium pool and
//!   provide it all to a new Raydium spot pool.
use anchor_lang::prelude::*;

declare_id!("EoJc1PYxZbnCjszampLcwJGYcB5Md47jM4oSQacRtD4d");


mod state;
mod instructions;
mod error;

use instructions::*;


/// TODO:
/// - add unstake
/// - add unit tests

#[program]
pub mod shared_liquidity_manager {
    use super::*;

    pub fn initialize_shared_liquidity_pool(ctx: Context<InitializeSharedLiquidityPool>, params: InitializeSharedLiquidityPoolParams) -> Result<()> {
        InitializeSharedLiquidityPool::handle(ctx, params)
    }

    pub fn initialize_draft_proposal(ctx: Context<InitializeDraftProposal>, params: InitializeDraftProposalParams) -> Result<()> {
        InitializeDraftProposal::handle(ctx, params)
    }

    pub fn stake_to_draft_proposal(ctx: Context<StakeToDraftProposal>, params: StakeToDraftProposalParams) -> Result<()> {
        StakeToDraftProposal::handle(ctx, params)
    }

    #[access_control(ctx.accounts.validate(&params))]
    pub fn unstake_from_draft_proposal(ctx: Context<UnstakeFromDraftProposal>, params: UnstakeFromDraftProposalParams) -> Result<()> {
        UnstakeFromDraftProposal::handle(ctx, params)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn deposit_shared_liquidity(ctx: Context<DepositSharedLiquidity>, params: DepositSharedLiquidityParams) -> Result<()> {
        DepositSharedLiquidity::handle(ctx, params)
    }

    #[access_control(ctx.accounts.validate(&params))]
    pub fn withdraw_shared_liquidity(ctx: Context<WithdrawSharedLiquidity>, params: WithdrawSharedLiquidityParams) -> Result<()> {
        WithdrawSharedLiquidity::handle(ctx, params)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn initialize_proposal_with_liquidity(ctx: Context<InitializeProposalWithLiquidity>, params: InitializeProposalWithLiquidityParams) -> Result<()> {
        InitializeProposalWithLiquidity::handle(ctx, params)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn remove_proposal_liquidity(ctx: Context<RemoveProposalLiquidity>) -> Result<()> {
        RemoveProposalLiquidity::handle(ctx)
    }
}
