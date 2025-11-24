use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, Token, TokenAccount, Transfer},
};
use futarchy::{Dao, PoolState};

use crate::{fee_wallet, state::BidWall, usdc_mint, FEE_BPS};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SellTokensArgs {
    pub amount_in: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(has_one = dao, has_one = base_mint)]
    pub bid_wall: Account<'info, BidWall>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, associated_token::mint = base_mint, associated_token::authority = user)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = user)]
    pub user_usdc_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = bid_wall)]
    pub bid_wall_usdc_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = fee_wallet::id())]
    pub fee_wallet_usdc_token_account: Account<'info, TokenAccount>,

    #[account(address = usdc_mint::id())]
    pub quote_mint: Account<'info, Mint>,
    pub base_mint: Account<'info, Mint>,

    #[account(has_one = base_mint, has_one = quote_mint)]
    pub dao: Account<'info, Dao>,

    #[account(associated_token::mint = quote_mint, associated_token::authority = dao.squads_multisig_vault)]
    pub dao_treasury_usdc_token_account: Account<'info, TokenAccount>,

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

        let token_total_supply = ctx.accounts.base_mint.supply;

        let (dao_lp_tokens, dao_lp_usdc) = match &ctx.accounts.dao.amm.state {
            PoolState::Spot { spot } => (spot.base_reserves, spot.quote_reserves),
            PoolState::Futarchy { spot, pass, fail } => (
                spot.base_reserves
                    .checked_add(
                        (pass.base_reserves + fail.base_reserves)
                            .checked_div(2)
                            .unwrap(),
                    )
                    .unwrap(),
                spot.quote_reserves
                    .checked_add(
                        (pass.quote_reserves + fail.quote_reserves)
                            .checked_div(2)
                            .unwrap(),
                    )
                    .unwrap(),
            ),
        };

        // TODO: Implement DAMM token and USDC calculations.
        let (dao_damm_tokens, dao_damm_usdc) = (0, 0);

        let dao_treasury_usdc = ctx.accounts.dao_treasury_usdc_token_account.amount;

        let dao_nav = dao_treasury_usdc
            .checked_add(dao_lp_usdc)
            .unwrap()
            .checked_add(dao_damm_usdc)
            .unwrap();

        // Supply within the hands of users.
        let token_active_supply = token_total_supply
            .checked_sub(dao_lp_tokens)
            .unwrap()
            .checked_sub(dao_damm_tokens)
            .unwrap();

        // Token price = DAO NAV / active supply
        // amount_out is always rounded down.
        let amount_out_before_fee = (amount_in as u128)
            .checked_mul(dao_nav as u128)
            .unwrap()
            .checked_div(token_active_supply as u128)
            .unwrap() as u64;

        // fee is always rounded up, so we need to add 1 if the remainder is not 0.
        let fee_numerator = (amount_out_before_fee as u128)
            .checked_mul(FEE_BPS as u128)
            .unwrap();
        let fee_denominator = 10_000;

        let fee = fee_numerator.checked_div(fee_denominator).unwrap() as u64;

        let fee = if fee_numerator.checked_rem(fee_denominator).unwrap() != 0 {
            fee.checked_add(1).unwrap()
        } else {
            fee
        };

        let amount_out_after_fee = amount_out_before_fee - fee;

        // Burn tokens
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
                    ctx.accounts.base_mint.key().as_ref(),
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
                    ctx.accounts.base_mint.key().as_ref(),
                    ctx.accounts.bid_wall.authority.as_ref(),
                    &[ctx.accounts.bid_wall.pda_bump],
                ]],
            ),
            fee,
        )?;
        Ok(())
    }
}
