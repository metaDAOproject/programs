use anchor_lang::prelude::*;

use crate::state::SharedLiquidityPool;

use autocrat::state::Dao;
use raydium_cpmm_cpi::states::PoolState;

#[event_cpi]
#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + std::mem::size_of::<SharedLiquidityPool>(),
        seeds = [b"pool", spot_pool_state.key().as_ref(), dao.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, SharedLiquidityPool>,
    pub spot_pool_state: AccountLoader<'info, PoolState>,
    pub dao: Account<'info, Dao>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl InitializePool<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        ctx.accounts.pool.set_inner(SharedLiquidityPool {
            pda_bump: ctx.bumps.pool,
            spot_pool_state: ctx.accounts.spot_pool_state.key(),
            dao: ctx.accounts.dao.key(),
            seq_num: 0,
        });

        Ok(())
    }
}
