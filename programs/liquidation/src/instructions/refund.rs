use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, Token, TokenAccount, Transfer},
};

use crate::{
    error::LiquidationError,
    events::{CommonFields, RefundEvent},
    state::{Liquidation, RefundRecord, SEED_LIQUIDATION},
};

#[event_cpi]
#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub recipient: Signer<'info>,

    #[account(mut)]
    pub liquidation: Account<'info, Liquidation>,

    #[account(
        mut,
        has_one = liquidation @ LiquidationError::InvalidAuthority,
        has_one = recipient @ LiquidationError::InvalidAuthority,
    )]
    pub refund_record: Account<'info, RefundRecord>,

    #[account(
        mut,
        constraint = base_mint.key() == liquidation.base_mint @ LiquidationError::InvalidMint,
    )]
    pub base_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint = base_mint,
        token::authority = recipient,
    )]
    pub recipient_base_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = liquidation,
    )]
    pub liquidation_quote_vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = recipient,
        associated_token::mint = quote_mint,
        associated_token::authority = recipient,
    )]
    pub recipient_quote_account: Account<'info, TokenAccount>,

    #[account(
        constraint = quote_mint.key() == liquidation.quote_mint @ LiquidationError::InvalidMint,
    )]
    pub quote_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl Refund<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        require!(
            self.liquidation.is_refunding,
            LiquidationError::RefundingNotEnabled
        );

        require!(
            clock.unix_timestamp
                <= self.liquidation.started_at + self.liquidation.duration_seconds as i64,
            LiquidationError::RefundWindowExpired
        );

        let remaining_burnable = self.refund_record.base_assigned - self.refund_record.base_burned;
        let effective_burn = remaining_burnable.min(self.recipient_base_account.amount);

        require_gt!(effective_burn, 0, LiquidationError::NothingToRefund);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let clock = Clock::get()?;
        let refund_record = &ctx.accounts.refund_record;

        // Compute effective burn
        let remaining_burnable = refund_record.base_assigned - refund_record.base_burned;
        let effective_burn = remaining_burnable.min(ctx.accounts.recipient_base_account.amount);

        // Burn base tokens from recipient
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.base_mint.to_account_info(),
                    from: ctx.accounts.recipient_base_account.to_account_info(),
                    authority: ctx.accounts.recipient.to_account_info(),
                },
            ),
            effective_burn,
        )?;

        // Update base_burned totals
        let refund_record = &mut ctx.accounts.refund_record;
        let liquidation = &mut ctx.accounts.liquidation;

        refund_record.base_burned += effective_burn;
        liquidation.total_base_burned += effective_burn;

        // Compute quote owed
        let quote_owed = (refund_record.quote_refundable as u128
            * refund_record.base_burned as u128
            / refund_record.base_assigned as u128) as u64;

        // Compute transfer amount
        let quote_transfer = quote_owed - refund_record.quote_refunded;

        // Transfer quote tokens from vault to recipient (PDA-signed)
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
                    to: ctx.accounts.recipient_quote_account.to_account_info(),
                    authority: liquidation.to_account_info(),
                },
                signer_seeds,
            ),
            quote_transfer,
        )?;

        // Update quote_refunded totals
        refund_record.quote_refunded += quote_transfer;
        liquidation.total_quote_refunded += quote_transfer;

        // Emit event
        liquidation.seq_num += 1;

        emit_cpi!(RefundEvent {
            common: CommonFields::new(&clock, liquidation.seq_num),
            liquidation: liquidation.key(),
            recipient: ctx.accounts.recipient.key(),
            base_burned: effective_burn,
            quote_refunded: quote_transfer,
            post_record_base_burned: refund_record.base_burned,
            post_record_quote_refunded: refund_record.quote_refunded,
            post_liquidation_total_base_burned: liquidation.total_base_burned,
            post_liquidation_total_quote_refunded: liquidation.total_quote_refunded,
        });

        Ok(())
    }
}
