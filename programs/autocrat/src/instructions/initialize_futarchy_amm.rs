use super::*;

use anchor_spl::associated_token::AssociatedToken;

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
    pub dao: Account<'info, Dao>,
    pub create_key: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub base_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = base_mint,
        associated_token::authority = futarchy_amm,
    )]
    pub amm_base_vault: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = quote_mint,
        associated_token::authority = futarchy_amm,
    )]
    pub amm_quote_vault: Account<'info, TokenAccount>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
}

impl InitializeFutarchyAmm<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let clock = Clock::get()?;
        let dao = &ctx.accounts.dao;

        ctx.accounts.futarchy_amm.set_inner(FutarchyAmm {
            state: PoolState::Spot {
                spot: Pool {
                    quote_reserves: 0,
                    base_reserves: 0,
                    quote_protocol_fee_balance: 0,
                    base_protocol_fee_balance: 0,
                    oracle: TwapOracle::new(
                        clock.slot,
                        dao.twap_initial_observation,
                        dao.twap_max_observation_change_per_update,
                        dao.twap_start_delay_slots,
                    ),
                },
            },
            total_liquidity: 0,
            base_mint: ctx.accounts.base_mint.key(),
            quote_mint: ctx.accounts.quote_mint.key(),
            amm_base_vault: ctx.accounts.amm_base_vault.key(),
            amm_quote_vault: ctx.accounts.amm_quote_vault.key(),
            pda_bump: ctx.bumps.futarchy_amm,
        });
        Ok(())
    }
}
