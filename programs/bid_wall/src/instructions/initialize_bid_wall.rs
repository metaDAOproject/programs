use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::{state::BidWall, usdc_mint};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeBidWallArgs {
    pub amount: u64,
    pub initial_amm_base_reserves: u64,
    pub initial_amm_quote_reserves: u64,
    pub initial_nav: u64,
    pub initial_dao_treasury_quote_amount: u64,
    pub duration_seconds: u32,
}

#[event_cpi]
#[derive(Accounts)]
pub struct InitializeBidWall<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + BidWall::INIT_SPACE,
        seeds = [b"bid_wall", base_mint.key().as_ref(), authority.key().as_ref()],
        bump
    )]
    pub bid_wall: Account<'info, BidWall>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: This is the recipient of the fees collected by the bid wall, no need to validate
    pub fee_recipient: AccountInfo<'info>,

    // Authority must sign to prevent unauthorized bid wall initialization on their behalf
    pub authority: Signer<'info>,

    #[account(init_if_needed, payer = payer, associated_token::mint = quote_mint, associated_token::authority = bid_wall)]
    pub bid_wall_usdc_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = authority)]
    pub authority_usdc_token_account: Account<'info, TokenAccount>,

    /// CHECK: Used for constraints
    pub dao_treasury: AccountInfo<'info>,

    pub base_mint: Account<'info, Mint>,

    #[account(address = usdc_mint::id())]
    pub quote_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl InitializeBidWall<'_> {
    pub fn validate(&self, _args: &InitializeBidWallArgs) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: InitializeBidWallArgs) -> Result<()> {
        // Bid wall account has been created using init constraint
        // Bid wall USDC ATA has been created using init_if_needed constraint

        // Transfer USDC to bid wall
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.authority_usdc_token_account.to_account_info(),
                    to: ctx.accounts.bid_wall_usdc_token_account.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            args.amount,
        )?;

        // Initialize bid wall account
        ctx.accounts.bid_wall.set_inner(BidWall {
            created_timestamp: Clock::get()?.unix_timestamp,
            fees_collected: 0,
            initial_amm_base_reserves: args.initial_amm_base_reserves,
            initial_amm_quote_reserves: args.initial_amm_quote_reserves,
            initial_dao_treasury_quote_amount: args.initial_dao_treasury_quote_amount,
            initial_nav: args.initial_nav,
            dao_treasury: ctx.accounts.dao_treasury.key(),
            authority: ctx.accounts.authority.key(),
            base_mint: ctx.accounts.base_mint.key(),
            fee_recipient: ctx.accounts.fee_recipient.key(),
            duration_seconds: args.duration_seconds,
            pda_bump: ctx.bumps.bid_wall,
        });

        Ok(())
    }
}
