use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct SpotSwapParams {
    pub swap_type: SwapType,
    pub input_amount: u64,
    pub min_output_amount: u64,
}

#[derive(Accounts)]
pub struct SpotSwap<'info> {
    #[account(mut)]
    pub futarchy_amm: Account<'info, FutarchyAmm>,
}

impl SpotSwap<'_> {
    pub fn handle(ctx: Context<Self>, params: SpotSwapParams) -> Result<()> {
        let SpotSwapParams { swap_type, input_amount, min_output_amount } = params;

        ctx.accounts.futarchy_amm.state.swap(input_amount, swap_type, Market::Spot)?;

        Ok(())
    }
}