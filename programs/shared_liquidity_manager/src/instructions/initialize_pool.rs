use anchor_lang::prelude::*;

use crate::state::SharedLiquidityPool;

use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

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
    pub token_0_mint: Account<'info, Mint>,
    pub token_1_mint: Account<'info, Mint>,
    #[account(has_one = token_0_mint, has_one = token_1_mint)]
    pub spot_pool_state: AccountLoader<'info, PoolState>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = lp_mint,
        associated_token::authority = pool,
    )]
    pub lp_token_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = token_0_mint,
        associated_token::authority = pool,
    )]
    pub token_0_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = token_1_mint,
        associated_token::authority = pool,
    )]
    pub token_1_vault: Account<'info, TokenAccount>,
    #[account(
        address = spot_pool_state.load()?.lp_mint
    )]
    pub lp_mint: Account<'info, Mint>,
    pub dao: Account<'info, Dao>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl InitializePool<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        ctx.accounts.pool.set_inner(SharedLiquidityPool {
            pda_bump: ctx.bumps.pool,
            spot_pool_state: ctx.accounts.spot_pool_state.key(),
            lp_token_vault: ctx.accounts.lp_token_vault.key(),
            token_0_vault: ctx.accounts.token_0_vault.key(),
            token_1_vault: ctx.accounts.token_1_vault.key(),
            dao: ctx.accounts.dao.key(),
            is_active_proposal: false,
            seq_num: 0,
        });

        Ok(())
    }
}
