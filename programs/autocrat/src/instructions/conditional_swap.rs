use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct ConditionalSwapParams {
    pub market: Market,
    pub swap_type: SwapType,
    pub input_amount: u64,
    pub min_output_amount: u64,
}


#[derive(Accounts)]
pub struct ConditionalSwap<'info> {
    #[account(mut, has_one = amm_base_vault, has_one = amm_quote_vault)]
    pub futarchy_amm: Account<'info, FutarchyAmm>,
    #[account(mut, associated_token::mint = futarchy_amm.base_mint, associated_token::authority = futarchy_amm)]
    pub amm_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = futarchy_amm.quote_mint, associated_token::authority = futarchy_amm)]
    pub amm_quote_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = base_vault.conditional_token_mints[1], associated_token::authority = futarchy_amm)]
    pub amm_pass_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = quote_vault.conditional_token_mints[1], associated_token::authority = futarchy_amm)]
    pub amm_pass_quote_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = base_vault.conditional_token_mints[0], associated_token::authority = futarchy_amm)]
    pub amm_fail_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = quote_vault.conditional_token_mints[0], associated_token::authority = futarchy_amm)]
    pub amm_fail_quote_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub user_input_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub user_output_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub base_vault: Box<Account<'info, conditional_vault::state::ConditionalVault>>,
    #[account(mut)]
    pub base_vault_underlying_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub quote_vault: Box<Account<'info, conditional_vault::state::ConditionalVault>>,
    pub token_program: Program<'info, Token>,
    pub trader: Signer<'info>,
    #[account(mut)]
    pub pass_base_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub fail_base_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub pass_quote_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub fail_quote_mint: Box<Account<'info, Mint>>,
    pub conditional_vault_program: Program<'info, ConditionalVaultProgram>,
    /// CHECK: 
    pub vault_event_authority: UncheckedAccount<'info>,
    pub question: Account<'info, Question>,
}

impl ConditionalSwap<'_> {
    pub fn handle(ctx: Context<Self>, params: ConditionalSwapParams) -> Result<()> {
        let ConditionalSwapParams { market, swap_type, input_amount, min_output_amount } = params;

        assert_ne!(market, Market::Spot);

        let (amm_input_account, amm_output_account) = match (swap_type, market) {
            (SwapType::Buy, Market::Pass) => (&ctx.accounts.amm_pass_quote_vault, &ctx.accounts.amm_pass_base_vault),
            (SwapType::Sell, Market::Pass) => (&ctx.accounts.amm_pass_base_vault, &ctx.accounts.amm_pass_quote_vault),
            (SwapType::Buy, Market::Fail) => (&ctx.accounts.amm_fail_quote_vault, &ctx.accounts.amm_fail_base_vault),
            (SwapType::Sell, Market::Fail) => (&ctx.accounts.amm_fail_base_vault, &ctx.accounts.amm_fail_quote_vault),
            (_, Market::Spot) => unreachable!(),
        };

        let (user_input_account, user_output_account) = (&ctx.accounts.user_input_account, &ctx.accounts.user_output_account);

        require_gte!(user_input_account.amount, input_amount);

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

        let output_amount = ctx.accounts.futarchy_amm.state.swap(input_amount, swap_type, market)?;

        let amount_to_mint = output_amount.saturating_sub(amm_output_account.amount);

        msg!("what to mint: {}", amount_to_mint);

        let signer_seeds = &[b"futarchy_amm".as_ref(), &[ctx.accounts.futarchy_amm.pda_bump]];
        let signer = &[&signer_seeds[..]];


        let base_cpi_context = CpiContext::new_with_signer(
            ctx.accounts.conditional_vault_program.to_account_info(),
            conditional_vault::cpi::accounts::InteractWithVault {
                question: ctx.accounts.question.to_account_info(),
                vault: ctx.accounts.base_vault.to_account_info(),
                vault_underlying_token_account: ctx
                    .accounts
                    .base_vault_underlying_token_account
                    .to_account_info(),
                authority: ctx.accounts.futarchy_amm.to_account_info(),
                user_underlying_token_account: ctx
                    .accounts
                    .amm_base_vault
                    .to_account_info(),
                event_authority: ctx.accounts.vault_event_authority.to_account_info(),
                program: ctx.accounts.conditional_vault_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            signer
        )
        .with_remaining_accounts(vec![
            ctx.accounts.fail_base_mint.to_account_info(),
            ctx.accounts.pass_base_mint.to_account_info(),
            ctx.accounts.amm_fail_base_vault.to_account_info(),
            ctx.accounts.amm_pass_base_vault.to_account_info(),
        ]);

        // if base_split_or_merge.split_or_merge == SplitOrMerge::Split {
            conditional_vault::cpi::split_tokens(base_cpi_context, amount_to_mint)?;

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: amm_output_account.to_account_info(),
                    to: user_output_account.to_account_info(),
                    authority: ctx.accounts.futarchy_amm.to_account_info(),
                },
                signer
            ),
            output_amount,
        )?;

        Ok(())
    }
}