use super::*;

// TODO: allow users to close their `AmmPosition` account for the 0.0015 SOL

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
#[event_cpi]
pub struct WithdrawLiquidity<'info> {
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
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
        seeds = [SEED_AMM_POSITION, dao.key().as_ref(), position_authority.key().as_ref()],
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
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let liquidity_provider_key = liquidity_provider.key();

        let (base_withdrawn, quote_withdrawn) = withdraw_from_position(
            dao,
            amm_position,
            liquidity_to_withdraw,
            amm_base_vault,
            amm_quote_vault,
            liquidity_provider_base_account,
            liquidity_provider_quote_account,
            token_program,
        )?;

        // Checked after the core has already mutated state; an Err reverts
        // the whole instruction, so this is equivalent to checking before.
        require_gte!(
            base_withdrawn,
            min_base_amount,
            FutarchyError::SwapSlippageExceeded
        );
        require_gte!(
            quote_withdrawn,
            min_quote_amount,
            FutarchyError::SwapSlippageExceeded
        );

        dao.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(WithdrawLiquidityEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            dao: dao.key(),
            liquidity_provider: liquidity_provider_key,
            liquidity_withdrawn: liquidity_to_withdraw,
            min_base_amount,
            min_quote_amount,
            base_amount: base_withdrawn,
            quote_amount: quote_withdrawn,
            post_amm_state: dao.amm.clone(),
        });

        Ok(())
    }
}

/// Burns `liquidity_to_withdraw` from `position` and pays out the pro-rata
/// share of the spot reserves from the AMM vaults to the recipient accounts.
/// Returns `(base_withdrawn, quote_withdrawn)`.
///
/// Owns the shared state transition only: callers should persist `position`
/// if it lives behind an `UncheckedAccount`, enforce slippage, bump
/// `seq_num`, and emit their own event.
pub fn withdraw_from_position<'info>(
    dao: &mut Account<'info, Dao>,
    position: &mut AmmPosition,
    liquidity_to_withdraw: u128,
    amm_base_vault: &Account<'info, TokenAccount>,
    amm_quote_vault: &Account<'info, TokenAccount>,
    recipient_base_account: &Account<'info, TokenAccount>,
    recipient_quote_account: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
) -> Result<(u64, u64)> {
    require_gte!(
        position.liquidity,
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
        let PoolState::Spot { ref mut spot } = dao.amm.state else {
            return err!(FutarchyError::PoolNotInSpotState);
        };

        let (base_to_withdraw, quote_to_withdraw) =
            spot.get_base_and_quote_withdrawable(liquidity_to_withdraw, total_liquidity);
        spot.base_reserves -= base_to_withdraw;
        spot.quote_reserves -= quote_to_withdraw;

        (base_to_withdraw, quote_to_withdraw)
    };

    position.liquidity -= liquidity_to_withdraw;
    dao.amm.total_liquidity -= liquidity_to_withdraw;

    let dao_creator = dao.dao_creator;
    let nonce = dao.nonce.to_le_bytes();
    let signer_seeds = &[
        SEED_DAO,
        dao_creator.as_ref(),
        nonce.as_ref(),
        &[dao.pda_bump],
    ];

    for (amount_to_withdraw, from, to) in [
        (base_to_withdraw, amm_base_vault, recipient_base_account),
        (quote_to_withdraw, amm_quote_vault, recipient_quote_account),
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

    Ok((base_to_withdraw, quote_to_withdraw))
}
