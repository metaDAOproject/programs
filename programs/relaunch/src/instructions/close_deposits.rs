use anchor_lang::prelude::*;

use crate::error::RelaunchError;
use crate::events::{CommonFields, DepositsClosedEvent};
use crate::state::{Relaunch, RelaunchState};

#[event_cpi]
#[derive(Accounts)]
pub struct CloseDeposits<'info> {
    #[account(mut)]
    pub relaunch: Account<'info, Relaunch>,
}

impl CloseDeposits<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.relaunch.state == RelaunchState::Live,
            RelaunchError::RelaunchNotLive
        );

        let clock = Clock::get()?;
        require_gte!(
            clock.unix_timestamp,
            self.relaunch.unix_timestamp_started.unwrap()
                + self.relaunch.seconds_for_deposits as i64,
            RelaunchError::DepositWindowStillOpen
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let relaunch = &mut ctx.accounts.relaunch;
        let clock = Clock::get()?;

        // threshold_bps × old_supply_snapshot overflows u64 for supplies
        // above ~1.8e15 raw units, so the threshold math runs in u128.
        let threshold =
            relaunch.threshold_bps as u128 * relaunch.old_supply_snapshot as u128 / 10_000;

        relaunch.state = if relaunch.total_deposited as u128 >= threshold {
            RelaunchState::SellPending
        } else {
            RelaunchState::Failed
        };
        relaunch.unix_timestamp_closed = Some(clock.unix_timestamp);

        relaunch.seq_num += 1;

        emit_cpi!(DepositsClosedEvent {
            common: CommonFields::new(&clock, ctx.accounts.relaunch.seq_num),
            relaunch: ctx.accounts.relaunch.key(),
            new_state: ctx.accounts.relaunch.state,
        });

        Ok(())
    }
}
