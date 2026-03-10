use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    error::LiquidationError,
    events::{CommonFields, WithdrawRemainingQuoteEvent},
    state::{Liquidation, SEED_LIQUIDATION},
};

#[event_cpi]
#[derive(Accounts)]
pub struct WithdrawRemainingQuote<'info> {
    pub liquidation_authority: Signer<'info>,

    #[account(
        mut,
        has_one = liquidation_authority @ LiquidationError::InvalidAuthority,
        has_one = quote_mint @ LiquidationError::InvalidMint,
        seeds = [SEED_LIQUIDATION, liquidation.base_mint.as_ref(), quote_mint.key().as_ref(), liquidation.create_key.as_ref()],
        bump = liquidation.pda_bump,
    )]
    pub liquidation: Account<'info, Liquidation>,

    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = liquidation,
    )]
    pub liquidation_quote_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = quote_mint,
        token::authority = liquidation_authority,
    )]
    pub liquidation_authority_quote_account: Account<'info, TokenAccount>,

    pub quote_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

impl WithdrawRemainingQuote<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        require!(
            self.liquidation.is_refunding,
            LiquidationError::RefundingNotEnabled
        );

        require!(
            clock.unix_timestamp
                > self.liquidation.started_at + self.liquidation.duration_seconds as i64,
            LiquidationError::RefundWindowNotExpired
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let clock = Clock::get()?;
        let liquidation = &mut ctx.accounts.liquidation;

        let amount = ctx.accounts.liquidation_quote_vault.amount;

        let signer_seeds: &[&[&[u8]]] = &[&[
            SEED_LIQUIDATION,
            liquidation.base_mint.as_ref(),
            liquidation.quote_mint.as_ref(),
            liquidation.create_key.as_ref(),
            &[liquidation.pda_bump],
        ]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.liquidation_quote_vault.to_account_info(),
                    to: ctx
                        .accounts
                        .liquidation_authority_quote_account
                        .to_account_info(),
                    authority: liquidation.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        liquidation.seq_num += 1;

        emit_cpi!(WithdrawRemainingQuoteEvent {
            common: CommonFields::new(&clock, liquidation.seq_num),
            liquidation: liquidation.key(),
            liquidation_authority: ctx.accounts.liquidation_authority.key(),
            amount,
        });

        Ok(())
    }
}
