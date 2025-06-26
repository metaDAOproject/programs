use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::*;

#[event_cpi]
#[derive(Accounts)]
pub struct AddOrRemoveLiquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        has_one = lp_mint,
    )]
    pub amm: Account<'info, Amm>,
    #[account(mut)]
    pub lp_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        token::mint = lp_mint,
        token::authority = user,
    )]
    pub user_lp_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        // token::mint = amm.base_mint,
        token::authority = user,
    )]
    pub user_base_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        // token::mint = amm.quote_mint,
        token::authority = user,
    )]
    pub user_quote_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = amm.base_mint,
        associated_token::authority = amm,
    )]
    pub vault_ata_base: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = amm.quote_mint,
        associated_token::authority = amm,
    )]
    pub vault_ata_quote: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
