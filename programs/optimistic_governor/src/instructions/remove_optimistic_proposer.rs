use anchor_lang::prelude::*;
use crate::state::*;
use crate::events::*;
use crate::instructions::Auth;

pub fn handler(ctx: Context<Auth>, optimistic_proposer: Pubkey) -> Result<()> {
    let timelock = &mut ctx.accounts.timelock;
    
    let index = timelock
        .optimistic_proposers
        .iter()
        .position(|proposer| proposer.pubkey == optimistic_proposer);
    
    let index = match index {
        Some(index) => index,
        None => return Ok(()), // idempotent
    };
    
    timelock.optimistic_proposers.remove(index);
    
    emit!(OptimisticProposerRemoved {
        timelock: timelock.key(),
        optimistic_proposer,
    });
    
    Ok(())
}