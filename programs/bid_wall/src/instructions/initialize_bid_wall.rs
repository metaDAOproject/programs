use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};
use futarchy::Dao;

use crate::{
    meteora_state::{Pool, Position},
    state::BidWall,
    usdc_mint,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeBidWallArgs {
    pub amount: u64,
    pub min_duration: u32,
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

    #[account(has_one = base_mint)]
    pub dao: Box<Account<'info, Dao>>,

    #[account(init_if_needed, payer = payer, associated_token::mint = quote_mint, associated_token::authority = bid_wall)]
    pub bid_wall_usdc_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = authority)]
    pub authority_usdc_token_account: Account<'info, TokenAccount>,

    pub base_mint: Account<'info, Mint>,

    #[account(address = usdc_mint::id())]
    pub quote_mint: Account<'info, Mint>,

    /// CHECK: Discriminator checked inside validate
    #[account(owner = damm_v2_cpi::id())]
    pub pool: UncheckedAccount<'info>,

    /// CHECK: Discriminator and pool checked inside validate
    #[account(owner = damm_v2_cpi::id())]
    pub position: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl InitializeBidWall<'_> {
    pub fn validate(&self, _args: &InitializeBidWallArgs) -> Result<()> {
        // TODO: Validate that the pool and position are the correct ones for the DAO.
        let pool_data = self.pool.try_borrow_data()?;
        let pool_discriminator = &pool_data[..8];
        Pool::validate_discriminator(pool_discriminator)?;

        let position_data = self.position.try_borrow_data()?;
        let position_discriminator = &position_data[..8];
        Position::validate_discriminator(position_discriminator)?;

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
            pda_bump: ctx.bumps.bid_wall,
            authority: ctx.accounts.authority.key(),
            base_mint: ctx.accounts.base_mint.key(),
            created_timestamp: Clock::get()?.unix_timestamp,
            min_duration: args.min_duration,
            dao: ctx.accounts.dao.key(),
            pool: ctx.accounts.pool.key(),
            position: ctx.accounts.position.key(),
            fees_collected: 0,
        });

        Ok(())
    }
}
