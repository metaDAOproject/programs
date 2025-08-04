use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitializeFutarchyAmmParams {
    pub quote_token_amount: u64,
    pub base_token_amount: u64,
}

#[derive(Accounts)]
pub struct InitializeFutarchyAmm<'info> {
    #[account(
        init,
        payer = payer,
        seeds = [b"futarchy_amm"],
        bump,
        space = 8 + FutarchyAmm::INIT_SPACE,
    )]
    pub futarchy_amm: Account<'info, FutarchyAmm>,
    pub create_key: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl InitializeFutarchyAmm<'_> {
    pub fn handle(ctx: Context<Self>, params: InitializeFutarchyAmmParams) -> Result<()> {

        ctx.accounts.futarchy_amm.set_inner(FutarchyAmm { 
            state: PoolState::Spot { spot: Pool { quote_reserves: params.quote_token_amount, base_reserves: params.base_token_amount } }
        });
        Ok(())
    }
}