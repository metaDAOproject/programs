use super::*;

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
    #[account(mut)]
    pub dao: Account<'info, Dao>,
    pub position_authority: Signer<'info>,
    #[account(
        mut,
        token::mint = dao.base_mint,
        token::authority = position_authority,
    )]
    pub liquidity_provider_base_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = dao.quote_mint,
        token::authority = position_authority,
    )]
    pub liquidity_provider_quote_account: Account<'info, TokenAccount>,
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
        mut,
        seeds = [b"amm_position", dao.key().as_ref(), position_authority.key().as_ref()],
        bump,
        has_one = dao,
        has_one = position_authority,
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
            dao,
            position_authority: liquidity_provider,
            liquidity_provider_base_account,
            liquidity_provider_quote_account,
            amm_base_vault,
            amm_quote_vault,
            amm_position,
            token_program,
        } = ctx.accounts;

        // Get the key before any borrows
        let liquidity_provider_key = liquidity_provider.key();

        require_gte!(
            amm_position.liquidity,
            liquidity_to_withdraw,
            FutarchyError::InsufficientBalance
        );

        require!(
            liquidity_to_withdraw > 0,
            FutarchyError::ZeroLiquidityRemove
        );

        let total_liquidity = dao.amm.total_liquidity;
        require_gt!(total_liquidity, 0, FutarchyError::AssertFailed);

        let (base_to_withdraw, quote_to_withdraw) = {
            let PoolState::Spot { ref spot } = dao.amm.state else {
                // TODO: check that pool is already in right state
                unreachable!();
            };
            spot.get_base_and_quote_withdrawable(
                liquidity_to_withdraw as u64,
                total_liquidity as u64,
            )
        };

        require_gte!(
            base_to_withdraw,
            min_base_amount,
            FutarchyError::SwapSlippageExceeded
        );
        require_gte!(
            quote_to_withdraw,
            min_quote_amount,
            FutarchyError::SwapSlippageExceeded
        );

        // Update the AMM position
        amm_position.liquidity -= liquidity_to_withdraw;

        // Update the futarchy AMM
        dao.amm.total_liquidity -= liquidity_to_withdraw;
        {
            let PoolState::Spot { ref mut spot } = dao.amm.state else {
                unreachable!();
            };
            spot.base_reserves -= base_to_withdraw;
            spot.quote_reserves -= quote_to_withdraw;
        }

        let dao_creator = dao.dao_creator;
        let nonce = dao.nonce.to_le_bytes();
        let signer_seeds = &[
            b"dao".as_ref(),
            dao_creator.as_ref(),
            nonce.as_ref(),
            &[dao.pda_bump],
        ];

        for (amount_to_withdraw, from, to) in [
            (
                base_to_withdraw,
                amm_base_vault,
                liquidity_provider_base_account,
            ),
            (
                quote_to_withdraw,
                amm_quote_vault,
                liquidity_provider_quote_account,
            ),
        ] {
            token::transfer(
                CpiContext::new_with_signer(
                    token_program.to_account_info(),
                    Transfer {
                        from: from.to_account_info(),
                        to: to.to_account_info(),
                        authority: dao.to_account_info(),
                    },
                    &[&signer_seeds[..]],
                ),
                amount_to_withdraw,
            )?;
        }

        let clock = Clock::get()?;
        emit!(WithdrawLiquidityEvent {
            common: CommonFields::new(&clock),
            dao: dao.key(),
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
