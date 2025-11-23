use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, Token, TokenAccount, Transfer},
};

use crate::{fee_wallet, state::BidWall, usdc_mint, FEE_BPS};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SellTokensArgs {
    pub amount_in: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account()]
    pub bid_wall: Account<'info, BidWall>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, associated_token::mint = token_mint, associated_token::authority = user)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = user)]
    pub user_usdc_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = bid_wall)]
    pub bid_wall_usdc_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = fee_wallet::id())]
    pub fee_wallet_usdc_token_account: Account<'info, TokenAccount>,

    #[account(address = usdc_mint::id())]
    pub usdc_mint: Account<'info, Mint>,
    pub token_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl SellTokens<'_> {
    pub fn validate(&self, _args: &SellTokensArgs) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: SellTokensArgs) -> Result<()> {
        let SellTokensArgs { amount_in } = args;

        // TODO: Calculate amount out based on NAV
        let amount_out = 100;

        let fee_numerator = (amount_out as u128).checked_mul(FEE_BPS as u128).unwrap();
        let fee_denominator = 10_000;

        let fee = fee_numerator.checked_div(fee_denominator).unwrap() as u64;

        let fee = if fee_numerator.checked_rem(fee_denominator).unwrap() != 0 {
            fee.checked_add(1).unwrap()
        } else {
            fee
        };

        let amount_out_after_fee = amount_out - fee;

        // Burn tokens
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_in,
        )?;

        // transfer USDC to user
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
                    ctx.accounts.token_mint.key().as_ref(),
                    ctx.accounts.bid_wall.authority.as_ref(),
                    &[ctx.accounts.bid_wall.pda_bump],
                ]],
            ),
            amount_out_after_fee,
        )?;

        // transfer fee to protocol fee wallet
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bid_wall_usdc_token_account.to_account_info(),
                    to: ctx.accounts.fee_wallet_usdc_token_account.to_account_info(),
                    authority: ctx.accounts.bid_wall.to_account_info(),
                },
                &[&[
                    b"bid_wall",
                    ctx.accounts.token_mint.key().as_ref(),
                    ctx.accounts.bid_wall.authority.as_ref(),
                    &[ctx.accounts.bid_wall.pda_bump],
                ]],
            ),
            fee,
        )?;
        Ok(())
    }
}
