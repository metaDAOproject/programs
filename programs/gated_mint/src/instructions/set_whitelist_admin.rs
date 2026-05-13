use anchor_lang::prelude::*;

use crate::{CommonFields, GatedMintConfig, GatedMintError, WhitelistAdminSetEvent};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SetWhitelistAdminArgs {
    pub whitelist_admin: Option<Pubkey>,
}

#[event_cpi]
#[derive(Accounts)]
pub struct SetWhitelistAdmin<'info> {
    #[account(
        mut,
        constraint = !gated_mint_config.gating_disabled @ GatedMintError::GatingDisabled,
    )]
    pub gated_mint_config: Account<'info, GatedMintConfig>,

    #[account(address = gated_mint_config.admin @ GatedMintError::UnauthorizedAdmin)]
    pub admin: Signer<'info>,
}

impl SetWhitelistAdmin<'_> {
    pub fn validate(&self, args: &SetWhitelistAdminArgs) -> Result<()> {
        if let Some(new_wl_admin) = args.whitelist_admin {
            require_keys_neq!(
                new_wl_admin,
                self.gated_mint_config.admin,
                GatedMintError::InvalidWhitelistAdmin
            );
        }
        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: SetWhitelistAdminArgs) -> Result<()> {
        let cfg = &mut ctx.accounts.gated_mint_config;
        let previous = cfg.whitelist_admin;

        cfg.whitelist_admin = args.whitelist_admin;
        cfg.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(WhitelistAdminSetEvent {
            common: CommonFields::new(&clock, cfg.seq_num),
            gated_mint_config: cfg.key(),
            mint: cfg.mint,
            previous_whitelist_admin: previous,
            new_whitelist_admin: cfg.whitelist_admin,
        });

        Ok(())
    }
}
