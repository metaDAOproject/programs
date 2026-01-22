use anchor_lang::prelude::*;

use crate::{
    CommonFields, MintAuthority, MintAuthorityRemovedEvent, MintGovernor, MintGovernorError,
};

#[derive(Accounts)]
pub struct RemoveMintAuthority<'info> {
    #[account(mut)]
    pub mint_governor: Account<'info, MintGovernor>,

    #[account(
        mut,
        close = rent_destination,
        has_one = mint_governor,
    )]
    pub mint_authority: Account<'info, MintAuthority>,

    #[account(address = mint_governor.admin @ MintGovernorError::UnauthorizedAdmin)]
    pub admin: Signer<'info>,

    /// CHECK: Receives rent lamports from closed account
    #[account(mut)]
    pub rent_destination: UncheckedAccount<'info>,
}

impl RemoveMintAuthority<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let mint_governor = &mut ctx.accounts.mint_governor;
        let mint_authority = &ctx.accounts.mint_authority;

        // Increment seq num
        mint_governor.seq_num += 1;

        // Emit event
        let clock = Clock::get()?;

        emit!(MintAuthorityRemovedEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
                mint_governor_seq_num: mint_governor.seq_num,
            },
            mint_governor: mint_governor.key(),
            authorized_minter: mint_authority.authorized_minter,
            total_minted: mint_authority.total_minted,
        });

        // Mint authority account gets closed using close constraint

        Ok(())
    }
}
