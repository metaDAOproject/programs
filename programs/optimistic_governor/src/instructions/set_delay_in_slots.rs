use anchor_lang::prelude::*;
use crate::state::*;
use crate::events::*;
use crate::instructions::Auth;

pub fn handler(ctx: Context<Auth>, delay_in_slots: u64) -> Result<()> {
    let old_delay = ctx.accounts.timelock.delay_in_slots;
    ctx.accounts.timelock.delay_in_slots = delay_in_slots;
    
    emit!(DelayUpdated {
        timelock: ctx.accounts.timelock.key(),
        old_delay,
        new_delay: delay_in_slots,
    });
    
    Ok(())
}