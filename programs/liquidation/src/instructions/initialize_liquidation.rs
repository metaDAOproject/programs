use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::{
    error::LiquidationError,
    events::{CommonFields, LiquidationCreatedEvent},
    state::Liquidation,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeLiquidationArgs {
    pub duration_seconds: u32,
}

#[event_cpi]
#[derive(Accounts)]
pub struct InitializeLiquidation<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub create_key: Signer<'info>,

    /// CHECK: Stored on the Liquidation account as the record authority.
    pub record_authority: UncheckedAccount<'info>,
    /// CHECK: Stored on the Liquidation account as the liquidation authority.
    pub liquidation_authority: UncheckedAccount<'info>,

    pub base_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        space = 8 + Liquidation::INIT_SPACE,
        seeds = [b"liquidation", base_mint.key().as_ref(), quote_mint.key().as_ref(), create_key.key().as_ref()],
        bump
    )]
    pub liquidation: Account<'info, Liquidation>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = quote_mint,
        associated_token::authority = liquidation,
    )]
    pub liquidation_quote_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl InitializeLiquidation<'_> {
    pub fn validate(&self, args: &InitializeLiquidationArgs) -> Result<()> {
        require_gt!(args.duration_seconds, 0, LiquidationError::InvalidDuration);
        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: InitializeLiquidationArgs) -> Result<()> {
        let clock = Clock::get()?;

        ctx.accounts.liquidation.set_inner(Liquidation {
            create_key: ctx.accounts.create_key.key(),
            record_authority: ctx.accounts.record_authority.key(),
            liquidation_authority: ctx.accounts.liquidation_authority.key(),
            base_mint: ctx.accounts.base_mint.key(),
            quote_mint: ctx.accounts.quote_mint.key(),
            total_quote_refundable: 0,
            total_quote_refunded: 0,
            total_base_assigned: 0,
            total_base_burned: 0,
            started_at: 0,
            duration_seconds: args.duration_seconds,
            seq_num: 0,
            is_refunding: false,
            pda_bump: ctx.bumps.liquidation,
        });

        emit_cpi!(LiquidationCreatedEvent {
            common: CommonFields::new(&clock, ctx.accounts.liquidation.seq_num),
            liquidation: ctx.accounts.liquidation.key(),
            record_authority: ctx.accounts.record_authority.key(),
            liquidation_authority: ctx.accounts.liquidation_authority.key(),
            base_mint: ctx.accounts.base_mint.key(),
            quote_mint: ctx.accounts.quote_mint.key(),
            duration_seconds: args.duration_seconds,
        });

        Ok(())
    }
}
