use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct ProvideLiquidityParams {
    /// How much quote token you will deposit to the pool
    pub quote_amount: u64,
    /// The maximum base token you will deposit to the pool
    pub max_base_amount: u64,
    /// The minimum liquidity you will be assigned
    pub min_liquidity: u128,
    /// The account that will own the LP position, usually the same as the
    /// liquidity provider
    pub position_authority: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: ProvideLiquidityParams)]
#[event_cpi]
pub struct ProvideLiquidity<'info> {
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
    pub liquidity_provider: Signer<'info>,
    #[account(
        mut,
        token::mint = dao.base_mint,
        token::authority = liquidity_provider,
    )]
    pub liquidity_provider_base_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = dao.quote_mint,
        token::authority = liquidity_provider,
    )]
    pub liquidity_provider_quote_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(
        mut,
        associated_token::mint = dao.base_mint,
        associated_token::authority = dao,
    )]
    pub amm_base_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = dao.quote_mint,
        associated_token::authority = dao,
    )]
    pub amm_quote_vault: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = payer,
        seeds = [b"amm_position", dao.key().as_ref(), params.position_authority.key().as_ref()],
        bump,
        space = 8 + AmmPosition::INIT_SPACE,
    )]
    pub amm_position: Account<'info, AmmPosition>,
    pub token_program: Program<'info, Token>,
}

impl ProvideLiquidity<'_> {
    pub fn handle(ctx: Context<Self>, params: ProvideLiquidityParams) -> Result<()> {
        let Self {
            dao,
            liquidity_provider,
            liquidity_provider_base_account,
            liquidity_provider_quote_account,
            payer: _,
            system_program: _,
            amm_base_vault,
            amm_quote_vault,
            amm_position,
            token_program,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let ProvideLiquidityParams {
            quote_amount,
            max_base_amount,
            min_liquidity,
            position_authority,
        } = params;

        let total_liquidity = dao.amm.total_liquidity;
        let PoolState::Spot { ref mut spot } = dao.amm.state else {
            return err!(FutarchyError::PoolNotInSpotState);
        };

        let (liquidity_to_mint, base_amount) = if total_liquidity > 0 {
            // require!(min_lp_tokens > 0, AmmError::ZeroMinLpTokens);
            require_gt!(min_liquidity, 0);

            let quote_reserves = spot.quote_reserves as u128;
            let base_reserves = spot.base_reserves as u128;

            // Use ceiling division to ensure the depositor provides at least their fair
            // share of base tokens, protecting existing LPs from rounding-based value extraction.
            // Formula: ceil(a / b) = (a + b - 1) / b
            let numerator = quote_amount as u128 * base_reserves;
            let base_amount: u64 = ((numerator + quote_reserves - 1) / quote_reserves)
                .try_into()
                .map_err(|_| FutarchyError::CastingOverflow)?;

            let liquidity_to_mint = (quote_amount as u128 * total_liquidity) / quote_reserves;

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
            require_gte!(quote_amount, MIN_QUOTE_LIQUIDITY);

            let base_amount = max_base_amount;

            let initial_liquidity = quote_amount as u128 * 1_000_000_000;

            require_gte!(
                initial_liquidity,
                min_liquidity,
                // AmmError::AddLiquiditySlippageExceeded
            );

            (initial_liquidity, base_amount)
        };

        spot.base_reserves += base_amount;
        spot.quote_reserves += quote_amount;

        // Check `dao` instead of `position_authority` to detect new accounts.
        // A valid DAO is always a PDA, never Pubkey::default(). Using `position_authority`
        // would fail for donations where position_authority = Pubkey::default(), causing
        // subsequent donations to overwrite liquidity instead of accumulating it.
        if amm_position.dao == Pubkey::default() {
            // New account - initialize all fields
            // Use position_authority to ensure consistency with PDA derivation
            amm_position.set_inner(AmmPosition {
                dao: dao.key(),
                position_authority,
                liquidity: liquidity_to_mint,
            });
        } else {
            // Existing account - only update liquidity
            // The position_authority is immutable once set
            amm_position.liquidity += liquidity_to_mint;
        }

        dao.amm.total_liquidity += liquidity_to_mint;

        token::transfer(
            CpiContext::new(
                token_program.to_account_info(),
                token::Transfer {
                    from: liquidity_provider_base_account.to_account_info(),
                    to: amm_base_vault.to_account_info(),
                    authority: liquidity_provider.to_account_info(),
                },
            ),
            base_amount,
        )?;

        token::transfer(
            CpiContext::new(
                token_program.to_account_info(),
                token::Transfer {
                    from: liquidity_provider_quote_account.to_account_info(),
                    to: amm_quote_vault.to_account_info(),
                    authority: liquidity_provider.to_account_info(),
                },
            ),
            quote_amount,
        )?;

        dao.seq_num += 1;

        let clock = Clock::get()?;

        emit_cpi!(ProvideLiquidityEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            dao: dao.key(),
            liquidity_provider: liquidity_provider.key(),
            position_authority,
            quote_amount,
            base_amount,
            liquidity_minted: liquidity_to_mint,
            min_liquidity,
            post_amm_state: dao.amm.clone(),
        });

        Ok(())
    }
}
