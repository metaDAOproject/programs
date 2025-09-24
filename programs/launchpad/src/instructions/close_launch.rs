use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchCloseEvent};
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
        require_eq!(
            self.launch.state,
            LaunchState::Live,
            LaunchpadError::LaunchNotLive
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

        emit_cpi!(LaunchCloseEvent {
            common: CommonFields::new(&clock, launch.seq_num),
            launch: launch.key(),
            new_state: launch.state,
        });

        Ok(())
    }
}
