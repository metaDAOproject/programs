use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_option::COption;
use anchor_spl::token::spl_token::instruction::AuthorityType;
use anchor_spl::token::{self, Mint, SetAuthority, Token};

use crate::{
    CommonFields, GatedMintConfig, GatedMintError, GatedMintInitializedEvent,
    GATED_MINT_CONFIG_SEED,
};

#[event_cpi]
#[derive(Accounts)]
pub struct InitializeGatedMint<'info> {
    #[account(
        mut,
        constraint = mint.freeze_authority == COption::Some(current_freeze_authority.key())
            @ GatedMintError::UnauthorizedFreezeAuthority,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        space = 8 + GatedMintConfig::INIT_SPACE,
        seeds = [GATED_MINT_CONFIG_SEED, mint.key().as_ref()],
        bump,
    )]
    pub gated_mint_config: Account<'info, GatedMintConfig>,

    pub current_freeze_authority: Signer<'info>,

    /// CHECK: stored on GatedMintConfig as the per-mint admin.
    pub admin: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl InitializeGatedMint<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let previous_authority = ctx.accounts.current_freeze_authority.key();
        let config_key = ctx.accounts.gated_mint_config.key();

        token::set_authority(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    current_authority: ctx.accounts.current_freeze_authority.to_account_info(),
                    account_or_mint: ctx.accounts.mint.to_account_info(),
                },
            ),
            AuthorityType::FreezeAccount,
            Some(config_key),
        )?;

        ctx.accounts.gated_mint_config.set_inner(GatedMintConfig {
            mint: ctx.accounts.mint.key(),
            admin: ctx.accounts.admin.key(),
            gating_disabled: false,
            seq_num: 0,
            bump: ctx.bumps.gated_mint_config,
        });

        let clock = Clock::get()?;
        let cfg = &ctx.accounts.gated_mint_config;
        emit_cpi!(GatedMintInitializedEvent {
            common: CommonFields::new(&clock, cfg.seq_num),
            gated_mint_config: config_key,
            mint: cfg.mint,
            admin: cfg.admin,
            previous_freeze_authority: previous_authority,
            pda_bump: cfg.bump,
        });

        Ok(())
    }
}
