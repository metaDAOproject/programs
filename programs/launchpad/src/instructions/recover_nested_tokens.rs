use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{Mint, Token, TokenAccount}};

use crate::{state::{Launch, associated_token_program::{RecoverNested, recover_nested}}};

#[event_cpi]
#[derive(Accounts)]
pub struct RecoverNestedTokens<'info> {
    #[account(
        mut,
        has_one = launch_quote_vault,
        has_one = launch_signer,
    )]
    pub launch: Account<'info, Launch>,

    #[account(mut)]
    pub launch_quote_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::authority = launch_quote_vault,
        associated_token::mint = launch_quote_vault.mint
    )]
    pub nested_launch_quote_vault: Account<'info, TokenAccount>,
    #[account(
        address = launch_quote_vault.mint
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: just a signer
    pub launch_signer: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl RecoverNestedTokens<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let seeds = &[
            b"launch_signer",
            ctx.accounts.launch.to_account_info().key.as_ref(),
            &[ctx.accounts.launch.launch_signer_pda_bump],
        ];
        let signer = &[&seeds[..]];

        let accounts = RecoverNested {
            nested_associated_account_address: ctx.accounts.nested_launch_quote_vault.to_account_info(),
            nested_associated_mint_address: ctx.accounts.mint.to_account_info(),
            destination_associated_account_address: ctx.accounts.launch_quote_vault.to_account_info(),
            owner_associated_account_address: ctx.accounts.launch_quote_vault.to_account_info(),
            owner_token_mint_address: ctx.accounts.mint.to_account_info(),
            wallet_address: ctx.accounts.launch_signer.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
        };

        recover_nested(
            CpiContext::new_with_signer(
                ctx.accounts.associated_token_program.to_account_info(), 
                accounts, 
                signer
            )
        )
    }
}
