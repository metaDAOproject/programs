use super::*;

use anchor_spl::token::{self, Transfer};

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct WithdrawLiquidityParams {
    /// How much liquidity to withdraw
    pub liquidity_to_withdraw: u128,
    /// Minimum base tokens to receive
    pub min_base_amount: u64,
    /// Minimum quote tokens to receive
    pub min_quote_amount: u64,
}

#[derive(Accounts)]
pub struct WithdrawLiquidity<'info> {
    #[account(mut, has_one = amm_base_vault, has_one = amm_quote_vault)]
    pub futarchy_amm: Account<'info, FutarchyAmm>,
    pub liquidity_provider: Signer<'info>,
    #[account(
        mut,
        token::mint = futarchy_amm.base_mint,
        token::authority = liquidity_provider,
    )]
    pub liquidity_provider_base_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = futarchy_amm.quote_mint,
        token::authority = liquidity_provider,
    )]
    pub liquidity_provider_quote_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = futarchy_amm.base_mint,
        associated_token::authority = futarchy_amm,
    )]
    pub amm_base_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = futarchy_amm.quote_mint,
        associated_token::authority = futarchy_amm,
    )]
    pub amm_quote_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"amm_position", futarchy_amm.key().as_ref(), liquidity_provider.key().as_ref()],
        bump,
        has_one = futarchy_amm,
        has_one = liquidity_provider,
    )]
    pub amm_position: Account<'info, AmmPosition>,
    pub token_program: Program<'info, Token>,
}

impl WithdrawLiquidity<'_> {
    pub fn handle(ctx: Context<Self>, params: WithdrawLiquidityParams) -> Result<()> {
        let WithdrawLiquidityParams {
            liquidity_to_withdraw,
            min_base_amount,
            min_quote_amount,
        } = params;

        let Self {
            futarchy_amm,
            liquidity_provider,
            liquidity_provider_base_account,
            liquidity_provider_quote_account,
            amm_base_vault,
            amm_quote_vault,
            amm_position,
            token_program,
        } = ctx.accounts;

        // Get the key before any borrows
        let futarchy_amm_key = futarchy_amm.key();
        let liquidity_provider_key = liquidity_provider.key();

        require_gte!(
            amm_position.liquidity,
            liquidity_to_withdraw,
            AutocratError::InsufficientBalance
        );

        require!(liquidity_to_withdraw > 0, AutocratError::ZeroLiquidityRemove);

        let total_liquidity = futarchy_amm.total_liquidity;
        require_gt!(total_liquidity, 0, AutocratError::AssertFailed);

        let (base_to_withdraw, quote_to_withdraw) = {
            let PoolState::Spot { ref spot } = futarchy_amm.state else {
                // TODO: check that pool is already in right state
                unreachable!();
            };
            spot.get_base_and_quote_withdrawable(liquidity_to_withdraw as u64, total_liquidity as u64)
        };

        require_gte!(
            base_to_withdraw,
            min_base_amount,
            AutocratError::SwapSlippageExceeded
        );
        require_gte!(
            quote_to_withdraw,
            min_quote_amount,
            AutocratError::SwapSlippageExceeded
        );

        // Update the AMM position
        amm_position.liquidity -= liquidity_to_withdraw;

        // Update the futarchy AMM
        futarchy_amm.total_liquidity -= liquidity_to_withdraw;
        {
            let PoolState::Spot { ref mut spot } = futarchy_amm.state else {
                unreachable!();
            };
            spot.base_reserves -= base_to_withdraw;
            spot.quote_reserves -= quote_to_withdraw;
        }

        // Transfer tokens from AMM vaults to user
        let signer_seeds = &[b"futarchy_amm".as_ref(), &[futarchy_amm.pda_bump]];

        for (amount_to_withdraw, from, to) in [
            (base_to_withdraw, amm_base_vault, liquidity_provider_base_account),
            (quote_to_withdraw, amm_quote_vault, liquidity_provider_quote_account),
        ] {
            token::transfer(
                CpiContext::new_with_signer(
                    token_program.to_account_info(),
                    Transfer {
                        from: from.to_account_info(),
                        to: to.to_account_info(),
                        authority: futarchy_amm.to_account_info(),
                    },
                    &[&signer_seeds[..]],
                ),
                amount_to_withdraw,
            )?;
        }

        let clock = Clock::get()?;
        emit!(WithdrawLiquidityEvent {
            common: CommonFields::new(&clock),
            futarchy_amm: futarchy_amm_key,
            liquidity_provider: liquidity_provider_key,
            liquidity_withdrawn: liquidity_to_withdraw,
            min_base_amount,
            min_quote_amount,
            base_amount: base_to_withdraw,
            quote_amount: quote_to_withdraw,
        });

        Ok(())
    }
} 