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
    pub base_vault: Box<Account<'info, conditional_vault::state::ConditionalVault>>,
    pub quote_vault: Box<Account<'info, conditional_vault::state::ConditionalVault>>,
}

impl ConditionalSwap<'_> {
    pub fn handle(ctx: Context<Self>, params: ConditionalSwapParams) -> Result<()> {
        let ConditionalSwapParams { market, swap_type, input_amount, min_output_amount } = params;

        assert_ne!(market, Market::Spot);

        ctx.accounts.futarchy_amm.state.swap(input_amount, swap_type, market)?;

        Ok(())
    }
}