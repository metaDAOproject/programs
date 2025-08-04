use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct SpotSwapParams {
    pub swap_type: SwapType,
    pub input_amount: u64,
    pub min_output_amount: u64,
}

#[derive(Accounts)]
pub struct SpotSwap<'info> {
    #[account(mut, has_one = amm_base_vault, has_one = amm_quote_vault)]
    pub futarchy_amm: Account<'info, FutarchyAmm>,
    pub trader: Signer<'info>,
    #[account(
        mut,
        token::mint = futarchy_amm.base_mint,
        token::authority = trader,
    )]
    pub user_base_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = futarchy_amm.quote_mint,
        token::authority = trader,
    )]
    pub user_quote_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub amm_base_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub amm_quote_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl SpotSwap<'_> {
    pub fn handle(ctx: Context<Self>, params: SpotSwapParams) -> Result<()> {
        let SpotSwapParams { swap_type, input_amount, min_output_amount } = params;

        let (user_input_account, amm_input_account, user_output_account, amm_output_account) = match swap_type {
            SwapType::Buy => (&ctx.accounts.user_quote_account, &ctx.accounts.amm_quote_vault, &ctx.accounts.user_base_account, &ctx.accounts.amm_base_vault),
            SwapType::Sell => (&ctx.accounts.user_base_account, &ctx.accounts.amm_base_vault, &ctx.accounts.user_quote_account, &ctx.accounts.amm_quote_vault),
        };

        require_gte!(user_input_account.amount, input_amount);

        let output_amount = ctx.accounts.futarchy_amm.state.swap(input_amount, swap_type, Market::Spot)?;

        require_gte!(output_amount, min_output_amount);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: user_input_account.to_account_info(),
                    to: amm_input_account.to_account_info(),
                    authority: ctx.accounts.trader.to_account_info(),
                }
            ),
            input_amount,
        )?;

        let signer_seeds = &[b"futarchy_amm".as_ref(), &[ctx.accounts.futarchy_amm.pda_bump]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: amm_output_account.to_account_info(),
                    to: user_output_account.to_account_info(),
                    authority: ctx.accounts.futarchy_amm.to_account_info(),
                },
                &[&signer_seeds[..]],
            ),
            output_amount,
        )?;

        Ok(())
    }
}