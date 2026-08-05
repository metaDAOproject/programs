use anchor_lang::prelude::*;

use crate::error::RelaunchError;
use crate::events::{CommonFields, RelaunchMarkedFailedEvent};
use crate::state::{Relaunch, RelaunchState};

#[event_cpi]
#[derive(Accounts)]
pub struct MarkFailed<'info> {
    #[account(mut)]
    pub relaunch: Account<'info, Relaunch>,
}

impl MarkFailed<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.relaunch.state == RelaunchState::SellPending,
            RelaunchError::RelaunchNotSellPending
        );

        let clock = Clock::get()?;
        require_gt!(
            clock.unix_timestamp,
            self.relaunch.unix_timestamp_closed.unwrap()
                + self.relaunch.grace_period_seconds as i64,
            RelaunchError::GracePeriodStillActive
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let relaunch = &mut ctx.accounts.relaunch;
        let clock = Clock::get()?;

        relaunch.state = RelaunchState::Failed;

        relaunch.seq_num += 1;

        emit_cpi!(RelaunchMarkedFailedEvent {
            common: CommonFields::new(&clock, ctx.accounts.relaunch.seq_num),
            relaunch: ctx.accounts.relaunch.key(),
        });

        Ok(())
    }
}
