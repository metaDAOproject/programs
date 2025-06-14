use anchor_lang::prelude::*;

use crate::state::SharedLiquidityPool;
use raydium_cpmm_cpi::states::PoolState;

#[event_cpi]
#[derive(Accounts)]
pub struct WithdrawSharedLiquidity<'info> {
    #[account(
        mut,
    )]
    pub pool: Account<'info, SharedLiquidityPool>,
}

impl WithdrawSharedLiquidity<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        // Ensure the pool is not being used by an active proposal
        require!(ctx.accounts.pool.active_proposal.is_none(), CustomError::PoolInUse);
        
        // TODO: Implement withdraw logic using Raydium's RemoveLiquidity instruction
        // This will involve:
        // 1. Burning the user's LP tokens
        // 2. Calling Raydium's RemoveLiquidity instruction
        // 3. Transferring the withdrawn tokens to the user
        
        Ok(())
    }
}

#[error_code]
pub enum CustomError {
    #[msg("Pool is currently being used by an active proposal")]
    PoolInUse,
} 