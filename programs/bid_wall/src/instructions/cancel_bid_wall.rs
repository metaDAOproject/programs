use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{state::BidWall, usdc_mint};

#[event_cpi]
#[derive(Accounts)]
pub struct CancelBidWall<'info> {
    #[account(
        mut,
        close=payer,
        has_one = authority
    )]
    pub bid_wall: Account<'info, BidWall>,

    #[account(mut)]
    pub payer: Signer<'info>,

    // Authority must sign to prevent unauthorized bid wall cancellation on their behalf
    #[account(address = bid_wall.authority)]
    pub authority: Signer<'info>,

    /// CHECK: used for constraints
    #[account(address = bid_wall.fee_recipient)]
    pub fee_recipient: UncheckedAccount<'info>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = bid_wall)]
    pub bid_wall_usdc_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = authority)]
    pub authority_usdc_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = fee_recipient)]
    pub fee_recipient_usdc_token_account: Account<'info, TokenAccount>,

    #[account(address = bid_wall.base_mint)]
    pub base_mint: Account<'info, Mint>,

    #[account(address = usdc_mint::id())]
    pub quote_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// TODO: Theoretically, we could merge the logic of this instruction with the close bid wall instruction.
impl CancelBidWall<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        // transfer fees collected to fee recipient
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bid_wall_usdc_token_account.to_account_info(),
                    to: ctx
                        .accounts
                        .fee_recipient_usdc_token_account
                        .to_account_info(),
                    authority: ctx.accounts.bid_wall.to_account_info(),
                },
                &[&[
                    b"bid_wall",
                    ctx.accounts.base_mint.key().as_ref(),
                    ctx.accounts.authority.key().as_ref(),
                    &[ctx.accounts.bid_wall.pda_bump],
                ]],
            ),
            ctx.accounts.bid_wall.fees_collected,
        )?;

        ctx.accounts.bid_wall_usdc_token_account.reload()?;

        // transfer all remaining USDC in bid wall USDC ATA back to authority
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bid_wall_usdc_token_account.to_account_info(),
                    to: ctx.accounts.authority_usdc_token_account.to_account_info(),
                    authority: ctx.accounts.bid_wall.to_account_info(),
                },
                &[&[
                    b"bid_wall",
                    ctx.accounts.base_mint.key().as_ref(),
                    ctx.accounts.authority.key().as_ref(),
                    &[ctx.accounts.bid_wall.pda_bump],
                ]],
            ),
            ctx.accounts.bid_wall_usdc_token_account.amount,
        )?;

        // Close the bid wall USDC ATA
        token::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::CloseAccount {
                account: ctx.accounts.bid_wall_usdc_token_account.to_account_info(),
                destination: ctx.accounts.payer.to_account_info(),
                authority: ctx.accounts.bid_wall.to_account_info(),
            },
            &[&[
                b"bid_wall",
                ctx.accounts.base_mint.key().as_ref(),
                ctx.accounts.authority.key().as_ref(),
                &[ctx.accounts.bid_wall.pda_bump],
            ]],
        ))?;

        // Bid wall account gets closed using close constraint

        Ok(())
    }
}
