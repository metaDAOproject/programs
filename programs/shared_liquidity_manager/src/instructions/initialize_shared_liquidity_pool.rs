use anchor_lang::prelude::*;

use crate::state::SharedLiquidityPool;

use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use autocrat::state::Dao;
use raydium_cpmm_cpi::states::PoolState as RaydiumPoolState;

#[event_cpi]
#[derive(Accounts)]
pub struct InitializeSharedLiquidityPool<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + std::mem::size_of::<SharedLiquidityPool>(),
        seeds = [b"sl_pool", dao.key().as_ref(), spot_pool.key().as_ref()],
        bump
    )]
    pub sl_pool: Account<'info, SharedLiquidityPool>,
    pub base_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,
    pub spot_pool: AccountLoader<'info, RaydiumPoolState>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = spot_pool_lp_mint,
        associated_token::authority = sl_pool,
    )]
    pub sl_pool_spot_lp_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = base_mint,
        associated_token::authority = sl_pool,
    )]
    pub sl_pool_base_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = quote_mint,
        associated_token::authority = sl_pool,
    )]
    pub sl_pool_quote_vault: Account<'info, TokenAccount>,

    pub spot_pool_lp_mint: Account<'info, Mint>,
    pub dao: Account<'info, Dao>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl InitializeSharedLiquidityPool<'_> {
    pub fn validate(&self) -> Result<()> {
        require_eq!(self.dao.token_mint, self.base_mint.key());
        require_eq!(self.dao.usdc_mint, self.quote_mint.key());

        let spot_pool = self.spot_pool.load()?;

        require_neq!(self.base_mint.key(), self.quote_mint.key());

        let is_base_token_0 = self.base_mint.key() < self.quote_mint.key();

        let (expected_base_mint, expected_quote_mint) = if is_base_token_0 {
            (spot_pool.token_0_mint, spot_pool.token_1_mint)
        } else {
            (spot_pool.token_1_mint, spot_pool.token_0_mint)
        };

        require_eq!(spot_pool.token_0_mint, expected_base_mint);
        require_eq!(spot_pool.token_1_mint, expected_quote_mint);
        require_eq!(self.spot_pool_lp_mint.key(), spot_pool.lp_mint);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        ctx.accounts.sl_pool.set_inner(SharedLiquidityPool {
            dao: ctx.accounts.dao.key(),
            spot_pool: ctx.accounts.spot_pool.key(),
            base_mint: ctx.accounts.base_mint.key(),
            quote_mint: ctx.accounts.quote_mint.key(),
            is_base_token_0: ctx.accounts.base_mint.key() < ctx.accounts.quote_mint.key(),
            sl_pool_spot_lp_vault: ctx.accounts.sl_pool_spot_lp_vault.key(),
            sl_pool_base_vault: ctx.accounts.sl_pool_base_vault.key(),
            sl_pool_quote_vault: ctx.accounts.sl_pool_quote_vault.key(),
            active_proposal: None,
            pda_bump: ctx.bumps.sl_pool,
            seq_num: 0,
        });

        Ok(())
    }
}
