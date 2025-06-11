use anchor_lang::prelude::*;
use crate::state::*;
use crate::events::*;
use crate::instructions::Auth;

pub fn handler(ctx: Context<Auth>, cooldown_slots: u64) -> Result<()> {
    let old_cooldown = ctx.accounts.timelock.optimistic_proposer_cooldown_slots;
    ctx.accounts.timelock.optimistic_proposer_cooldown_slots = cooldown_slots;
    
    emit!(OptimisticProposerCooldownUpdated {
        timelock: ctx.accounts.timelock.key(),
        old_cooldown,
        new_cooldown: cooldown_slots,
    });
    
    Ok(())
}