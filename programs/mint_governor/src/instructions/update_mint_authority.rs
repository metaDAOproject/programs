use anchor_lang::prelude::*;

use crate::{
    CommonFields, MintAuthority, MintAuthorityUpdatedEvent, MintGovernor, MintGovernorError,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateMintAuthorityArgs {
    pub max_total: Option<u64>,
}

#[derive(Accounts)]
pub struct UpdateMintAuthority<'info> {
    #[account(mut)]
    pub mint_governor: Account<'info, MintGovernor>,

    #[account(mut, has_one = mint_governor)]
    pub mint_authority: Account<'info, MintAuthority>,

    #[account(address = mint_governor.admin @ MintGovernorError::UnauthorizedAdmin)]
    pub admin: Signer<'info>,
}

impl UpdateMintAuthority<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: UpdateMintAuthorityArgs) -> Result<()> {
        let mint_governor = &mut ctx.accounts.mint_governor;
        let mint_authority = &mut ctx.accounts.mint_authority;

        let previous_max_total = mint_authority.max_total;

        // Update max total
        mint_authority.max_total = args.max_total;

        // Increment seq num
        mint_governor.seq_num += 1;

        // Emit event
        let clock = Clock::get()?;

        emit!(MintAuthorityUpdatedEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
                mint_governor_seq_num: mint_governor.seq_num,
            },
            mint_governor: mint_governor.key(),
            mint_authority: mint_authority.key(),
            authorized_minter: mint_authority.authorized_minter,
            previous_max_total,
            new_max_total: args.max_total,
        });

        Ok(())
    }
}
