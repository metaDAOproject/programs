use anchor_lang::prelude::*;
use crate::state::*;
use crate::events::*;
use crate::instructions::Auth;

pub fn handler(ctx: Context<Auth>, authority: Pubkey) -> Result<()> {
    let old_authority = ctx.accounts.timelock.authority;
    ctx.accounts.timelock.authority = authority;
    
    emit!(AuthorityUpdated {
        timelock: ctx.accounts.timelock.key(),
        old_authority,
        new_authority: authority,
    });
    
    Ok(())
}