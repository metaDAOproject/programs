use crate::{error::BidWallError, state::BidWall, usdc_mint, FEE_BPS, TOKENS_TO_PARTICIPANTS};

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

// User sells tokens into the bid wall at the initial NAV per token, adjusted for treasury balance changes.
//
// NAV per token formula:
//
// dao.treasury_balance + initial_lp_quote + bid_wall_quote
// --------------------------------------------------------
//         base_at_launch - base_bought_by_bid_wall
//
// This formula works because we are only concerned with buying at the initial NAV per token,
// adjusted for treasury balance changes.
// Thus, if someone were to burn their tokens outside of the bid wall, they would be increasing
// the NAV per token, meaning that selling into bid wall would be LESS profitable, not more.

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

        // We calculate the total NAV as as sum of:
        // - The initial quote reserves of the Futarchy AMM
        // - The quote tokens in the DAO treasury (which can be spent by the DAO)
        // - The quote tokens in the bid wall (which are spent by selling into the bid wall)
        let total_nav: u128 = (ctx.accounts.bid_wall.initial_amm_quote_reserves
            + ctx.accounts.dao_treasury_quote_token_account.amount
            + ctx.accounts.bid_wall_quote_token_account.amount)
            as u128;

        // We work under the assumption that the total supply is 10M tokens
        // We then assume that base tokens are only burned by the bid wall.
        let remaining_base =
            (TOKENS_TO_PARTICIPANTS - ctx.accounts.bid_wall.base_bought_amount) as u128;

        let amount_out_before_fee =
            (amount_in as u128 * total_nav as u128 / remaining_base as u128) as u64;

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

        msg!("fees collected: {}", fee);

        // Track fees collected and base tokens bought up by the bid wall
        ctx.accounts.bid_wall.fees_collected += fee;
        ctx.accounts.bid_wall.base_bought_amount += amount_in;

        Ok(())
    }
}
