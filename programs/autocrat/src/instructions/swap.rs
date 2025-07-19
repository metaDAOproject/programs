use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::{state::{Dao, Amm, Side}, AmmState, TokenType};

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct SwapParams {
    pub token_in: TokenType,
    pub token_out: TokenType,
    pub amount_in: u64,
    pub min_out: u64,
}

// #[derive(Accounts)]
// #[event_cpi]
// pub struct Swap<'info> {
//     #[account(mut)]
//     pub futarchy_amm: Account<'info, FutarchyAmm>,
//     pub trader: Signer<'info>,
//     pub trader_base_account: Account<'info, TokenAccount>,
//     pub trader_quote_account: Account<'info, TokenAccount>,
//     pub token_program: Program<'info, Token>,
// }

#[derive(Accounts)]
pub struct AmmTokenAccounts<'info> {
    #[account(mut)]
    pub base_unconditional: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub quote_unconditional: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub base_pass: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub quote_pass: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub base_fail: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub quote_fail: Box<Account<'info, TokenAccount>>,
}

#[derive(Accounts)]
#[event_cpi]
pub struct Swap<'info> {
    #[account(mut)]
    pub futarchy_amm: Account<'info, Amm>,
    pub trader: Signer<'info>,
    #[account(mut)]
    pub trader_input_account: Account<'info, TokenAccount>,
    pub amm_token_accounts: AmmTokenAccounts<'info>,
    pub question: Box<Account<'info, conditional_vault::state::Question>>,
    pub base_mint: Box<Account<'info, token::Mint>>,
    pub quote_mint: Box<Account<'info, token::Mint>>,
    #[account(mut)]
    pub quote_vault: Box<Account<'info, conditional_vault::state::ConditionalVault>>,
    #[account(mut)]
    pub quote_vault_underlying_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub base_vault: Box<Account<'info, conditional_vault::state::ConditionalVault>>,
    #[account(mut)]
    pub base_vault_underlying_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub conditional_vault_program: Program<'info, conditional_vault::program::ConditionalVault>,
    /// CHECK: verified by conditional_vault
    pub vault_event_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub pass_quote_mint: Box<Account<'info, token::Mint>>,
    #[account(mut)]
    pub fail_quote_mint: Box<Account<'info, token::Mint>>,
    #[account(mut)]
    pub pass_base_mint: Box<Account<'info, token::Mint>>,
    #[account(mut)]
    pub fail_base_mint: Box<Account<'info, token::Mint>>,
}

impl Swap<'_> {
    pub fn handle(ctx: Context<Self>, params: SwapParams) -> Result<()> {
        let SwapParams { token_in, token_out, amount_in, min_out } = params;

        // TODO: apply fees

        match ctx.accounts.futarchy_amm.state {
            AmmState::Spot => {
                // Normal yk=k swap
            }
            AmmState::Futarchy { proposal: _, question: _ } => {
                // Futarchy AMM swap



            }

        }

        Ok(())
    }
}
