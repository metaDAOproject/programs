use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    error::LiquidationError,
    events::{CommonFields, LiquidationActivatedEvent},
    state::Liquidation,
};

#[event_cpi]
#[derive(Accounts)]
pub struct ActivateLiquidation<'info> {
    pub liquidation_authority: Signer<'info>,

    #[account(
        mut,
        has_one = liquidation_authority @ LiquidationError::InvalidAuthority,
    )]
    pub liquidation: Account<'info, Liquidation>,

    #[account(
        mut,
        token::mint = quote_mint,
        token::authority = liquidation_authority,
    )]
    pub liquidation_authority_quote_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = liquidation,
    )]
    pub liquidation_quote_vault: Account<'info, TokenAccount>,

    #[account(
        constraint = quote_mint.key() == liquidation.quote_mint @ LiquidationError::InvalidMint,
    )]
    pub quote_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

impl ActivateLiquidation<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            !self.liquidation.is_refunding,
            LiquidationError::AlreadyActivated
        );

        require_gt!(
            self.liquidation.total_base_assigned,
            0,
            LiquidationError::NoBaseAssigned
        );

        require_gt!(
            self.liquidation.total_quote_refundable,
            0,
            LiquidationError::NothingToFund
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let clock = Clock::get()?;
        let liquidation = &mut ctx.accounts.liquidation;

        // Transfer total_quote_refundable from authority to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx
                        .accounts
                        .liquidation_authority_quote_account
                        .to_account_info(),
                    to: ctx.accounts.liquidation_quote_vault.to_account_info(),
                    authority: ctx.accounts.liquidation_authority.to_account_info(),
                },
            ),
            liquidation.total_quote_refundable,
        )?;

        // Permanently enable refunding
        liquidation.started_at = clock.unix_timestamp;
        liquidation.is_refunding = true;

        // Emit event
        liquidation.seq_num += 1;

        emit_cpi!(LiquidationActivatedEvent {
            common: CommonFields::new(&clock, liquidation.seq_num),
            liquidation: liquidation.key(),
            total_quote_funded: liquidation.total_quote_refundable,
            started_at: liquidation.started_at,
        });

        Ok(())
    }
}
