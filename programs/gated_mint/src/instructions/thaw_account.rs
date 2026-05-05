use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::spl_token;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    AccountThawedEvent, CommonFields, GatedMintConfig, GatedMintError, GATED_MINT_CONFIG_SEED,
};

#[event_cpi]
#[derive(Accounts)]
pub struct ThawAccount<'info> {
    #[account(
        mut,
        has_one = mint @ GatedMintError::MintMismatch,
        constraint = gated_mint_config.gating_disabled @ GatedMintError::GatingNotDisabled,
    )]
    pub gated_mint_config: Account<'info, GatedMintConfig>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = token_account.mint == mint.key() @ GatedMintError::MintMismatch,
    )]
    pub token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl ThawAccount<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let config = &mut ctx.accounts.gated_mint_config;
        let mint_key = ctx.accounts.mint.key();
        let config_key = config.key();
        let signer_seeds: &[&[&[u8]]] =
            &[&[GATED_MINT_CONFIG_SEED, mint_key.as_ref(), &[config.bump]]];

        let ix = spl_token::instruction::thaw_account(
            &spl_token::ID,
            &ctx.accounts.token_account.key(),
            &mint_key,
            &config_key,
            &[],
        )?;
        invoke_signed(
            &ix,
            &[
                ctx.accounts.token_account.to_account_info(),
                ctx.accounts.mint.to_account_info(),
                config.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        config.seq_num += 1;
        let clock = Clock::get()?;
        emit_cpi!(AccountThawedEvent {
            common: CommonFields::new(&clock, config.seq_num),
            gated_mint_config: config_key,
            mint: mint_key,
            token_account: ctx.accounts.token_account.key(),
        });

        Ok(())
    }
}
