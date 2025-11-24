use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::{error::BidWallError, state::BidWall, usdc_mint};

#[event_cpi]
#[derive(Accounts)]
pub struct CloseBidWall<'info> {
    #[account(
        mut,
        close=payer,
        seeds = [b"bid_wall", base_mint.key().as_ref(), authority.key().as_ref()],
        bump,
        has_one = authority
    )]
    pub bid_wall: Account<'info, BidWall>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub authority: Signer<'info>,

    #[account(mut, close=payer, associated_token::mint = usdc_mint, associated_token::authority = bid_wall)]
    pub bid_wall_usdc_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = authority)]
    pub authority_usdc_token_account: Account<'info, TokenAccount>,

    #[account(address = usdc_mint::id())]
    pub usdc_mint: Account<'info, Mint>,

    #[account(address = bid_wall.base_mint)]
    pub base_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl CloseBidWall<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        // Only allow closing the bid wall if it has been open for at least the minimum duration.
        require_gt!(
            self.bid_wall
                .created_timestamp
                .checked_add(self.bid_wall.min_duration as i64)
                .unwrap(),
            clock.unix_timestamp,
            BidWallError::BidWallNotExpired
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        // transfer USDC back to authority
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bid_wall_usdc_token_account.to_account_info(),
                    to: ctx.accounts.authority_usdc_token_account.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
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

        // Bid wall account gets closed using close constraint
        // Bid wall USDC ATA gets closed using close constraint

        Ok(())
    }
}
