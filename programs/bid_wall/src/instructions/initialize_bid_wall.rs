use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::{
    events::{BidWallInitializedEvent, CommonFields},
    state::BidWall,
    usdc_mint,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeBidWallArgs {
    pub amount: u64,
    pub nonce: u64,
    pub initial_amm_quote_reserves: u64,
    pub duration_seconds: u32,
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(args: InitializeBidWallArgs)]
pub struct InitializeBidWall<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + BidWall::INIT_SPACE,
        seeds = [b"bid_wall", base_mint.key().as_ref(), creator.key().as_ref(), args.nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub bid_wall: Account<'info, BidWall>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: This is the recipient of the fees collected by the bid wall, no need to validate
    pub fee_recipient: AccountInfo<'info>,

    // Creator must sign to prevent unauthorized bid wall initialization on their behalf
    pub creator: Signer<'info>,

    /// CHECK: The authority with the rights of cancelling the bid wall and retrieving the remaining quote tokens on close
    pub authority: AccountInfo<'info>,

    #[account(init_if_needed, payer = payer, associated_token::mint = quote_mint, associated_token::authority = bid_wall)]
    pub bid_wall_quote_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = creator)]
    pub creator_quote_token_account: Account<'info, TokenAccount>,

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
        // Bid wall quote ATA has been created using init_if_needed constraint

        // Transfer quote tokens to bid wall
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator_quote_token_account.to_account_info(),
                    to: ctx.accounts.bid_wall_quote_token_account.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
            ),
            args.amount,
        )?;

        let clock = Clock::get()?;

        // Initialize bid wall account
        ctx.accounts.bid_wall.set_inner(BidWall {
            nonce: args.nonce,
            created_timestamp: clock.unix_timestamp,
            initial_amm_quote_reserves: args.initial_amm_quote_reserves,
            fees_collected: 0,
            base_bought_amount: 0,
            seq_num: 0,
            creator: ctx.accounts.creator.key(),
            authority: ctx.accounts.authority.key(),
            dao_treasury: ctx.accounts.dao_treasury.key(),
            base_mint: ctx.accounts.base_mint.key(),
            fee_recipient: ctx.accounts.fee_recipient.key(),
            duration_seconds: args.duration_seconds,
            pda_bump: ctx.bumps.bid_wall,
        });

        emit_cpi!(BidWallInitializedEvent {
            common: CommonFields::new(&clock, ctx.accounts.bid_wall.seq_num),
            bid_wall: ctx.accounts.bid_wall.key(),
            nonce: args.nonce,
            initial_amm_quote_reserves: args.initial_amm_quote_reserves,
            amount: args.amount,
            creator: ctx.accounts.creator.key(),
            authority: ctx.accounts.authority.key(),
            dao_treasury: ctx.accounts.dao_treasury.key(),
            base_mint: ctx.accounts.base_mint.key(),
            fee_recipient: ctx.accounts.fee_recipient.key(),
            duration_seconds: args.duration_seconds,
            pda_bump: ctx.bumps.bid_wall,
        });

        Ok(())
    }
}
