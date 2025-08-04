use super::*;

use anchor_spl::associated_token::AssociatedToken;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct ProvideLiquidityParams {
    /// How much quote token you will deposit to the pool
    pub quote_amount: u64,
    /// The maximum base token you will deposit to the pool
    pub max_base_amount: u64,
    /// The minimum liquidity you will be assigned
    pub min_liquidity: u128,
}

#[derive(Accounts)]
pub struct ProvideLiquidity<'info> {
    #[account(has_one = amm_base_vault, has_one = amm_quote_vault)]
    pub futarchy_amm: Account<'info, FutarchyAmm>,
    pub liquidity_provider: Signer<'info>,
    #[account(
        mut,
        token::mint = base_mint,
        token::authority = liquidity_provider,
    )]
    pub liquidity_provider_base_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = quote_mint,
        token::authority = liquidity_provider,
    )]
    pub liquidity_provider_quote_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub base_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,
    #[account(
        associated_token::mint = base_mint,
        associated_token::authority = futarchy_amm,
    )]
    pub amm_base_vault: Account<'info, TokenAccount>,
    #[account(
        associated_token::mint = quote_mint,
        associated_token::authority = futarchy_amm,
    )]
    pub amm_quote_vault: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = payer,
        seeds = [b"amm_position", futarchy_amm.key().as_ref(), liquidity_provider.key().as_ref()],
        bump,
        space = 8 + AmmPosition::INIT_SPACE,
    )]
    pub amm_position: Account<'info, AmmPosition>,
    pub token_program: Program<'info, Token>,
}

impl ProvideLiquidity<'_> {
    pub fn handle(ctx: Context<Self>, params: ProvideLiquidityParams) -> Result<()> {
        let ProvideLiquidityParams {
            quote_amount,
            max_base_amount,
            min_liquidity,
        } = params;

        let Self {
            futarchy_amm,
            liquidity_provider,
            liquidity_provider_base_account,
            liquidity_provider_quote_account,
            payer,
            system_program,
            base_mint,
            quote_mint,
            amm_base_vault,
            amm_quote_vault,
            amm_position,
            token_program,
        } = ctx.accounts;

        let PoolState::Spot { spot } = futarchy_amm.state else {
            // TODO: check that pool is already in right state
            unreachable!();
        };

        let (liquidity_to_mint, base_amount) = if futarchy_amm.total_liquidity > 0 {
            // require!(min_lp_tokens > 0, AmmError::ZeroMinLpTokens);
            require_gt!(min_liquidity, 0);

            let quote_reserves = spot.quote_reserves as u128;
            let base_reserves = spot.base_reserves as u128;

            // this should only panic in an extreme scenario: when (quote_amount * base_reserve) / quote_reserve > u64::MAX
            let base_amount: u64 = (((quote_amount as u128 * base_reserves) / quote_reserves) + 1)
                .try_into()
                .map_err(|_| AutocratError::CastingOverflow)?;

            let liquidity_to_mint =
                ((quote_amount as u128 * futarchy_amm.total_liquidity) / quote_reserves);

            require_gte!(
                max_base_amount,
                base_amount,
                // AmmError::AddLiquidityMaxBaseExceeded
            );
            require_gte!(
                liquidity_to_mint,
                min_liquidity,
                // AmmError::AddLiquiditySlippageExceeded
            );

            (liquidity_to_mint, base_amount)
        } else {
            // equivalent to $0.1 if the quote is USDC, here for rounding
            require_gte!(quote_amount, 100_000);

            let base_amount = max_base_amount;

            let initial_liquidity = quote_amount as u128 * 1_000_000_000;

            (initial_liquidity, base_amount)
        };

        amm_position.set_inner(AmmPosition {
            futarchy_amm: futarchy_amm.key(),
            liquidity_provider: liquidity_provider.key(),
            liquidity: amm_position.liquidity + liquidity_to_mint,
        });

        // token::transfer(
        //     CpiContext::new(
        //         ctx.accounts.token_program.to_account_info(),
        //         token::Transfer {
        //             from: ctx.accounts.initializer_base_account.to_account_info(),
        //             to: ctx.accounts.amm_base_vault.to_account_info(),
        //             authority: ctx.accounts.initializer.to_account_info(),
        //         }
        //     ),
        //     params.base_token_amount,
        // )?;

        // token::transfer(
        //     CpiContext::new(
        //         ctx.accounts.token_program.to_account_info(),
        //         token::Transfer {
        //             from: ctx.accounts.initializer_quote_account.to_account_info(),
        //             to: ctx.accounts.amm_quote_vault.to_account_info(),
        //             authority: ctx.accounts.initializer.to_account_info(),
        //         }
        //     ),
        //     params.quote_token_amount,
        // )?;

        // ctx.accounts.futarchy_amm.set_inner(FutarchyAmm {
        //     state: PoolState::Spot { spot: Pool { quote_reserves: params.quote_token_amount, base_reserves: params.base_token_amount } },
        //     base_mint: ctx.accounts.base_mint.key(),
        //     quote_mint: ctx.accounts.quote_mint.key(),
        //     amm_base_vault: ctx.accounts.amm_base_vault.key(),
        //     amm_quote_vault: ctx.accounts.amm_quote_vault.key(),
        //     pda_bump: ctx.bumps.futarchy_amm,
        // });

        Ok(())
    }
}
