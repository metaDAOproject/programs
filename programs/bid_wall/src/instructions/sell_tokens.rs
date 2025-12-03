use crate::{error::BidWallError, state::BidWall, usdc_mint, FEE_BPS};

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SellTokensArgs {
    pub amount_in: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(mut, has_one = base_mint)]
    pub bid_wall: Account<'info, BidWall>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, associated_token::mint = base_mint, associated_token::authority = user)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = user)]
    pub user_quote_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = bid_wall)]
    pub bid_wall_quote_token_account: Account<'info, TokenAccount>,

    /// CHECK: used for constraints
    #[account(address = bid_wall.dao_treasury)]
    pub dao_treasury: AccountInfo<'info>,

    #[account(associated_token::mint = quote_mint, associated_token::authority = dao_treasury)]
    pub dao_treasury_quote_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub base_mint: Account<'info, Mint>,

    #[account(address = usdc_mint::id())]
    pub quote_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl SellTokens<'_> {
    pub fn validate(&self, _args: &SellTokensArgs) -> Result<()> {
        let clock = Clock::get()?;

        // Only allow selling tokens if the bid wall has not yet expired.
        require_gte!(
            self.bid_wall
                .created_timestamp
                .checked_add(self.bid_wall.duration_seconds as i64)
                .unwrap(),
            clock.unix_timestamp,
            BidWallError::BidWallExpired
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: SellTokensArgs) -> Result<()> {
        let SellTokensArgs { amount_in } = args;

        let amount_out_before_vault_adjustment: u128 = amount_in as u128
            * ctx.accounts.bid_wall.initial_amm_quote_reserves as u128
            / ctx.accounts.bid_wall.initial_amm_base_reserves as u128;

        let current_nav = ctx.accounts.bid_wall.initial_nav
            + ctx.accounts.dao_treasury_quote_token_account.amount
            - ctx.accounts.bid_wall.initial_dao_treasury_quote_amount;

        let amount_out_before_fee = (amount_out_before_vault_adjustment * current_nav as u128
            / ctx.accounts.bid_wall.initial_nav as u128) as u64;

        let amount_out_after_fee =
            ((10_000_u128 - FEE_BPS as u128) * amount_out_before_fee as u128 / 10_000_u128) as u64;

        let fee = amount_out_before_fee - amount_out_after_fee;

        // Burn base tokens
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.base_mint.to_account_info(),
                    from: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_in,
        )?;

        // Transfer quote tokens to user
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bid_wall_quote_token_account.to_account_info(),
                    to: ctx.accounts.user_quote_token_account.to_account_info(),
                    authority: ctx.accounts.bid_wall.to_account_info(),
                },
                &[&[
                    b"bid_wall",
                    ctx.accounts.base_mint.key().as_ref(),
                    ctx.accounts.bid_wall.creator.as_ref(),
                    ctx.accounts.bid_wall.nonce.to_le_bytes().as_ref(),
                    &[ctx.accounts.bid_wall.pda_bump],
                ]],
            ),
            amount_out_after_fee,
        )?;

        // Update fees collected by bid wall
        ctx.accounts.bid_wall.fees_collected += fee;

        Ok(())
    }
}
