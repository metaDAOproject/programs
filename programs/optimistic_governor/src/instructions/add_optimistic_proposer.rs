use anchor_lang::prelude::*;
use crate::state::*;
use crate::events::*;
use crate::instructions::Auth;

pub fn handler(ctx: Context<Auth>, enqueuer: Pubkey) -> Result<()> {
    let timelock = &mut ctx.accounts.timelock;
    
    // idempotent - if already exists, just return
    if timelock
        .optimistic_proposers
        .iter()
        .any(|enq| enq.pubkey == enqueuer)
    {
        return Ok(());
    }
    
    timelock.optimistic_proposers.push(OptimisticProposer {
        pubkey: enqueuer,
        last_slot_enqueued: 0,
    });
    
    emit!(OptimisticProposerAdded {
        timelock: timelock.key(),
        optimistic_proposer: enqueuer,
    });
    
    Ok(())
}