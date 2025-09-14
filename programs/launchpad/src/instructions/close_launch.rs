
use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchStartedEvent};
use crate::state::{Launch, LaunchState};
use anchor_lang::prelude::*;

#[event_cpi]
#[derive(Accounts)]
pub struct CloseLaunch<'info> {
    #[account(mut)]
    pub launch: Account<'info, Launch>,
}

impl CloseLaunch<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.launch.state == LaunchState::Live,
            LaunchpadError::LaunchNotInitialized
        );

        let clock = Clock::get()?;

        require_gte!(
            clock.unix_timestamp,
            self.launch
                .unix_timestamp_started
                .unwrap()
                .saturating_add(self.launch.seconds_for_launch.try_into().unwrap()),
            LaunchpadError::LaunchPeriodNotOver
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        let clock = Clock::get()?;

        if launch.minimum_raise_amount > launch.total_committed_amount {
            launch.state = LaunchState::Refunding;
            launch.unix_timestamp_closed = Some(clock.unix_timestamp);
        } else {
            launch.state = LaunchState::Closed;
            launch.unix_timestamp_closed = Some(clock.unix_timestamp);
        }

        launch.seq_num += 1;

        // emit_cpi!(LaunchStartedEvent {
        //     common: CommonFields::new(&clock, launch.seq_num),
        //     launch: ctx.accounts.launch.key(),
        //     launch_authority: ctx.accounts.launch_authority.key(),
        //     slot_started: clock.slot,
        // });

        Ok(())
    }
}