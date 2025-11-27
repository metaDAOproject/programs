use crate::error::BidWallError;
use crate::math::u128x128_math::Rounding;
use crate::meteora_state::{Pool, Position};
use crate::{state::BidWall, usdc_mint, FEE_BPS};

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

use futarchy::{Dao, PoolState};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SellTokensArgs {
    pub amount_in: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(mut, has_one = dao, has_one = base_mint, has_one = pool, has_one = position)]
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

    #[account(has_one = base_mint, has_one = quote_mint)]
    pub dao: Box<Account<'info, Dao>>,

    #[account(associated_token::mint = quote_mint, associated_token::authority = dao.squads_multisig_vault)]
    pub dao_treasury_usdc_token_account: Account<'info, TokenAccount>,

    /// CHECK: Discriminator checked inside validate
    #[account(owner = damm_v2_cpi::id(), address = bid_wall.pool)]
    pub pool: UncheckedAccount<'info>,

    /// CHECK: Discriminator and pool checked inside validate
    #[account(owner = damm_v2_cpi::id(), address = bid_wall.position)]
    pub position: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl SellTokens<'_> {
    pub fn validate(&self, _args: &SellTokensArgs) -> Result<()> {
        let pool_data = self.pool.try_borrow_data()?;
        let pool_discriminator = &pool_data[..8];
        Pool::validate_discriminator(pool_discriminator)?;

        let position_data = self.position.try_borrow_data()?;
        let position_discriminator = &position_data[..8];
        Position::validate_discriminator(position_discriminator)?;

        let position: &Position = bytemuck::from_bytes(&position_data[8..]);
        if position.pool != self.pool.key() {
            return Err(BidWallError::MeteoraDammPositionPoolMismatch.into());
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: SellTokensArgs) -> Result<()> {
        let SellTokensArgs { amount_in } = args;

        // Futarchy AMM Pool
        let (dao_futarchy_amm_tokens, dao_futarchy_amm_usdc) = match &ctx.accounts.dao.amm.state {
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

        // Meteora DAMM Pool
        let pool_data = ctx.accounts.pool.try_borrow_data()?;
        let pool: &Pool = bytemuck::from_bytes(&pool_data[8..]);

        let position_data = ctx.accounts.position.try_borrow_data()?;
        let position: &Position = bytemuck::from_bytes(&position_data[8..]);

        let pool_token_a_mint = pool.token_a_mint;

        let position_liquidity = position.vested_liquidity
            + position.unlocked_liquidity
            + position.permanent_locked_liquidity;

        let modify_liquidity_result =
            pool.get_amounts_for_modify_liquidity(position_liquidity, Rounding::Up)?;

        let (dao_damm_tokens, dao_damm_usdc) = if pool_token_a_mint == ctx.accounts.base_mint.key()
        {
            (
                modify_liquidity_result.token_a_amount,
                modify_liquidity_result.token_b_amount,
            )
        } else {
            (
                modify_liquidity_result.token_b_amount,
                modify_liquidity_result.token_a_amount,
            )
        };

        // DAO Treasury
        let dao_treasury_usdc = ctx.accounts.dao_treasury_usdc_token_account.amount;

        let dao_nav = dao_treasury_usdc + dao_futarchy_amm_usdc + dao_damm_usdc;

        // Supply within the hands of users
        let token_active_supply =
            ctx.accounts.base_mint.supply - dao_futarchy_amm_tokens - dao_damm_tokens;

        // Token price = DAO NAV / active supply
        // amount_out is always rounded down
        let amount_out_before_fee =
            (amount_in as u128 * dao_nav as u128 / token_active_supply as u128) as u64;

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
