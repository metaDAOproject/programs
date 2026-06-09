use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::{
    CommonFields, GatedMintConfig, GatedMintError, WhitelistedUser, WhitelistedUserRemovedEvent,
    WHITELISTED_USER_SEED,
};

#[event_cpi]
#[derive(Accounts)]
pub struct RemoveWhitelistedUser<'info> {
    #[account(
        mut,
        has_one = mint @ GatedMintError::MintMismatch,
        constraint = !gated_mint_config.gating_disabled @ GatedMintError::GatingDisabled,
    )]
    pub gated_mint_config: Account<'info, GatedMintConfig>,

    pub authority: Signer<'info>,

    pub mint: Account<'info, Mint>,

    /// CHECK: identifies the whitelist entry to remove; not signed.
    pub user: UncheckedAccount<'info>,

    #[account(
        mut,
        close = rent_destination,
        seeds = [WHITELISTED_USER_SEED, mint.key().as_ref(), user.key().as_ref()],
        bump = whitelisted_user.bump,
        has_one = mint @ GatedMintError::MintMismatch,
    )]
    pub whitelisted_user: Account<'info, WhitelistedUser>,

    /// CHECK: receives rent lamports from the closed whitelisted_user account.
    #[account(mut)]
    pub rent_destination: UncheckedAccount<'info>,
}

impl RemoveWhitelistedUser<'_> {
    pub fn validate(&self) -> Result<()> {
        let signer = self.authority.key();
        let is_admin = signer.eq(&self.gated_mint_config.admin);
        let is_whitelist_admin = self
            .gated_mint_config
            .whitelist_admin
            .map(|wa| wa.eq(&signer))
            .unwrap_or(false);
        require!(
            is_admin || is_whitelist_admin,
            GatedMintError::UnauthorizedWhitelistAuthority
        );
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let cfg = &mut ctx.accounts.gated_mint_config;
        cfg.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(WhitelistedUserRemovedEvent {
            common: CommonFields::new(&clock, cfg.seq_num),
            gated_mint_config: cfg.key(),
            whitelisted_user: ctx.accounts.whitelisted_user.key(),
            mint: ctx.accounts.mint.key(),
            user: ctx.accounts.user.key(),
            authority: ctx.accounts.authority.key(),
        });

        // `close = rent_destination` closes the whitelisted_user PDA after handle returns.
        Ok(())
    }
}
