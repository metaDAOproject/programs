use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{state::BidWall, usdc_mint};

#[event_cpi]
#[derive(Accounts)]
pub struct CollectFees<'info> {
    #[account(mut)]
    pub bid_wall: Account<'info, BidWall>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = bid_wall)]
    pub bid_wall_quote_token_account: Account<'info, TokenAccount>,

    /// CHECK: used for constraints
    #[account(address = bid_wall.fee_recipient)]
    pub fee_recipient: UncheckedAccount<'info>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = fee_recipient)]
    pub fee_recipient_quote_token_account: Account<'info, TokenAccount>,

    #[account(address = usdc_mint::id())]
    pub quote_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl CollectFees<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        // transfer fees collected to fee recipient
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bid_wall_quote_token_account.to_account_info(),
                    to: ctx
                        .accounts
                        .fee_recipient_quote_token_account
                        .to_account_info(),
                    authority: ctx.accounts.bid_wall.to_account_info(),
                },
                &[&[
                    b"bid_wall",
                    ctx.accounts.bid_wall.base_mint.as_ref(),
                    ctx.accounts.bid_wall.authority.as_ref(),
                    &[ctx.accounts.bid_wall.pda_bump],
                ]],
            ),
            ctx.accounts.bid_wall.fees_collected,
        )?;

        ctx.accounts.bid_wall.fees_collected = 0;

        Ok(())
    }
}
