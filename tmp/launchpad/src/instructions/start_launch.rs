use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchStartedEvent};
use crate::state::{Launch, LaunchState};
use anchor_lang::prelude::*;

#[event_cpi]
#[derive(Accounts)]
pub struct StartLaunch<'info> {
    #[account(
        mut,
        has_one = launch_authority,
    )]
    pub launch: Account<'info, Launch>,

    pub launch_authority: Signer<'info>,
}

impl StartLaunch<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.launch.state == LaunchState::Initialized,
            LaunchpadError::LaunchNotInitialized
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        let clock = Clock::get()?;

        launch.state = LaunchState::Live;
        launch.unix_timestamp_started = clock.unix_timestamp;

        launch.seq_num += 1;

        emit_cpi!(LaunchStartedEvent {
            common: CommonFields::new(&clock, launch.seq_num),
            launch: ctx.accounts.launch.key(),
            launch_authority: ctx.accounts.launch_authority.key(),
            slot_started: clock.slot,
        });

        Ok(())
    }
}
