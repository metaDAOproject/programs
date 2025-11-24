use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};
use futarchy::Dao;

use crate::{state::BidWall, usdc_mint};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeBidWallArgs {
    pub amount: u64,
    pub duration: u32,
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

    // Authority must sign to prevent unauthorized bid wall initialization on their behalf
    pub authority: Signer<'info>,

    #[account(init_if_needed, payer = payer, associated_token::mint = usdc_mint, associated_token::authority = bid_wall)]
    pub bid_wall_usdc_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = authority)]
    pub authority_usdc_token_account: Account<'info, TokenAccount>,

    #[account(address = usdc_mint::id())]
    pub usdc_mint: Account<'info, Mint>,
    pub base_mint: Account<'info, Mint>,

    #[account(has_one = base_mint)]
    pub dao: Account<'info, Dao>,

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

        // transfer USDC to bid wall
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

        // initialize bid wall account
        ctx.accounts.bid_wall.set_inner(BidWall {
            pda_bump: ctx.bumps.bid_wall,
            authority: ctx.accounts.authority.key(),
            base_mint: ctx.accounts.base_mint.key(),
            created_timestamp: Clock::get()?.unix_timestamp,
            min_duration: args.duration,
            dao: ctx.accounts.dao.key(),
            // TODO: See how to handle Meteora DAMMv2 position liquidity.
            meteora_cpmm_base_token_vault: Pubkey::default(),
        });

        Ok(())
    }
}
