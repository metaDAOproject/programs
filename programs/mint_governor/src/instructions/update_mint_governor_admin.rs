use anchor_lang::prelude::*;

use crate::{CommonFields, MintGovernor, MintGovernorAdminUpdatedEvent, MintGovernorError};

#[derive(Accounts)]
pub struct UpdateMintGovernorAdmin<'info> {
    #[account(mut)]
    pub mint_governor: Account<'info, MintGovernor>,

    #[account(address = mint_governor.admin @ MintGovernorError::UnauthorizedAdmin)]
    pub admin: Signer<'info>,

    /// CHECK: This is the new admin address, no validation needed
    pub new_admin: UncheckedAccount<'info>,
}

impl UpdateMintGovernorAdmin<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let mint_governor = &mut ctx.accounts.mint_governor;

        mint_governor.admin = ctx.accounts.new_admin.key();
        mint_governor.seq_num += 1;

        let clock = Clock::get()?;

        emit!(MintGovernorAdminUpdatedEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
                mint_governor_seq_num: mint_governor.seq_num,
            },
            mint_governor: mint_governor.key(),
            new_admin: ctx.accounts.new_admin.key(),
        });

        Ok(())
    }
}
