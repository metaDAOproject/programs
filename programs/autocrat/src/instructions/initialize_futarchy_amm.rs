use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::{state::{Dao, Amm}, AmmState, Pool};

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct InitializeFutarchyAmmParams {
    pub quote_amount: u64,
    pub base_amount: u64,
}

#[derive(Accounts)]
#[event_cpi]
pub struct InitializeFutarchyAmm<'info> {
    #[account(
        init,
        payer = payer,
        seeds = [b"futarchy_amm"],
        bump,
        space = 8 + Amm::INIT_SPACE,
    )]
    pub futarchy_amm: Account<'info, Amm>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub creator: Signer<'info>,
    #[account(has_one = base_mint, has_one = quote_mint)]
    pub dao: Account<'info, Dao>,
    pub base_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = base_mint,
        associated_token::authority = futarchy_amm,
    )]
    pub base_vault: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = quote_mint,
        associated_token::authority = futarchy_amm,
    )]
    pub quote_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = base_mint,
        token::authority = creator
    )]
    pub creator_base_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = quote_mint,
        token::authority = creator
    )]
    pub creator_quote_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl InitializeFutarchyAmm<'_> {
    pub fn handle(ctx: Context<Self>, params: InitializeFutarchyAmmParams) -> Result<()> {
        let InitializeFutarchyAmmParams { quote_amount, base_amount } = params;
        
        // Transfer base tokens from creator to base vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator_base_account.to_account_info(),
                    to: ctx.accounts.base_vault.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
            ),
            base_amount,
        )?;

        // Transfer quote tokens from creator to quote vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator_quote_account.to_account_info(),
                    to: ctx.accounts.quote_vault.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
            ),
            quote_amount,
        )?;
        
        ctx.accounts.futarchy_amm.set_inner(Amm {
            bump: ctx.bumps.futarchy_amm,
            dao: ctx.accounts.dao.key(),
            base_mint: ctx.accounts.base_mint.key(),
            quote_mint: ctx.accounts.quote_mint.key(),
            // spot_pool: Pool {
            //     base_reserves: base_amount,
            //     quote_reserves: quote_amount,
            // },
            base_vault: ctx.accounts.base_vault.key(),
            quote_vault: ctx.accounts.quote_vault.key(),
            state: AmmState::Spot,
        });

        Ok(())
    }
}
