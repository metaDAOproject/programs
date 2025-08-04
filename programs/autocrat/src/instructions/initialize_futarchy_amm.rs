use super::*;

use anchor_spl::associated_token::AssociatedToken;

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
    pub initializer: Signer<'info>,
    #[account(
        mut,
        token::mint = base_mint,
        token::authority = initializer,
    )]
    pub initializer_base_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = quote_mint,
        token::authority = initializer,
    )]
    pub initializer_quote_account: Account<'info, TokenAccount>,
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
    pub fn handle(ctx: Context<Self>, params: InitializeFutarchyAmmParams) -> Result<()> {

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.initializer_base_account.to_account_info(),
                    to: ctx.accounts.amm_base_vault.to_account_info(),
                    authority: ctx.accounts.initializer.to_account_info(),
                }
            ),
            params.base_token_amount,
        )?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.initializer_quote_account.to_account_info(),
                    to: ctx.accounts.amm_quote_vault.to_account_info(),
                    authority: ctx.accounts.initializer.to_account_info(),
                }
            ),
            params.quote_token_amount,
        )?;

        ctx.accounts.futarchy_amm.set_inner(FutarchyAmm { 
            state: PoolState::Spot { spot: Pool { quote_reserves: params.quote_token_amount, base_reserves: params.base_token_amount } },
            base_mint: ctx.accounts.base_mint.key(),
            quote_mint: ctx.accounts.quote_mint.key(),
            amm_base_vault: ctx.accounts.amm_base_vault.key(),
            amm_quote_vault: ctx.accounts.amm_quote_vault.key(),
            pda_bump: ctx.bumps.futarchy_amm,
        });
        Ok(())
    }
}