use crate::{state::BidWall, usdc_mint, FEE_BPS};

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
    pub user_usdc_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = bid_wall)]
    pub bid_wall_usdc_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub base_mint: Account<'info, Mint>,

    #[account(address = usdc_mint::id())]
    pub quote_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl SellTokens<'_> {
    pub fn validate(&self, _args: &SellTokensArgs) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: SellTokensArgs) -> Result<()> {
        let SellTokensArgs { amount_in } = args;

        let amount_out_before_fee =
            (amount_in as u128 * ctx.accounts.bid_wall.initial_amm_quote_reserves as u128
                / ctx.accounts.bid_wall.initial_amm_base_reserves as u128) as u64;

        msg!("amount_out_before_fee: {}", amount_out_before_fee);
        let amount_out_after_fee =
            ((10_000_u128 - FEE_BPS as u128) * amount_out_before_fee as u128 / 10_000_u128) as u64;

        msg!("amount_out_after_fee: {}", amount_out_after_fee);
        let fee = amount_out_before_fee - amount_out_after_fee;

        msg!("fee: {}", fee);
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

        // Transfer USDC to user
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bid_wall_usdc_token_account.to_account_info(),
                    to: ctx.accounts.user_usdc_token_account.to_account_info(),
                    authority: ctx.accounts.bid_wall.to_account_info(),
                },
                &[&[
                    b"bid_wall",
                    ctx.accounts.base_mint.key().as_ref(),
                    ctx.accounts.bid_wall.authority.as_ref(),
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
