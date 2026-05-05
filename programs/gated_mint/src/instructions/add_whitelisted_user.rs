use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::{
    CommonFields, GatedMintConfig, GatedMintError, WhitelistedUser, WhitelistedUserAddedEvent,
    WHITELISTED_USER_SEED,
};

#[event_cpi]
#[derive(Accounts)]
pub struct AddWhitelistedUser<'info> {
    #[account(
        mut,
        has_one = mint @ GatedMintError::MintMismatch,
        constraint = !gated_mint_config.gating_disabled @ GatedMintError::GatingDisabled,
    )]
    pub gated_mint_config: Account<'info, GatedMintConfig>,

    #[account(address = gated_mint_config.admin @ GatedMintError::UnauthorizedAdmin)]
    pub admin: Signer<'info>,

    pub mint: Account<'info, Mint>,

    /// CHECK: any pubkey may be whitelisted; not signed.
    pub user: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + WhitelistedUser::INIT_SPACE,
        seeds = [WHITELISTED_USER_SEED, mint.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub whitelisted_user: Account<'info, WhitelistedUser>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl AddWhitelistedUser<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let cfg = &mut ctx.accounts.gated_mint_config;
        cfg.seq_num += 1;

        ctx.accounts.whitelisted_user.set_inner(WhitelistedUser {
            mint: ctx.accounts.mint.key(),
            user: ctx.accounts.user.key(),
            bump: ctx.bumps.whitelisted_user,
        });

        let clock = Clock::get()?;
        emit_cpi!(WhitelistedUserAddedEvent {
            common: CommonFields::new(&clock, cfg.seq_num),
            gated_mint_config: cfg.key(),
            whitelisted_user: ctx.accounts.whitelisted_user.key(),
            mint: ctx.accounts.mint.key(),
            user: ctx.accounts.user.key(),
        });

        Ok(())
    }
}
