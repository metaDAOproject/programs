use anchor_lang::prelude::*;

use crate::error::RelaunchError;
use crate::events::{CommonFields, DepositsStartedEvent};
use crate::state::{Relaunch, RelaunchState};

#[event_cpi]
#[derive(Accounts)]
pub struct StartDeposits<'info> {
    #[account(
        mut,
        has_one = admin,
    )]
    pub relaunch: Account<'info, Relaunch>,

    pub admin: Signer<'info>,
}

impl StartDeposits<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.relaunch.state == RelaunchState::Initialized,
            RelaunchError::RelaunchNotInitialized
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let relaunch = &mut ctx.accounts.relaunch;
        let clock = Clock::get()?;

        relaunch.state = RelaunchState::Live;
        relaunch.unix_timestamp_started = Some(clock.unix_timestamp);

        relaunch.seq_num += 1;

        emit_cpi!(DepositsStartedEvent {
            common: CommonFields::new(&clock, ctx.accounts.relaunch.seq_num),
            relaunch: ctx.accounts.relaunch.key(),
            admin: ctx.accounts.admin.key(),
        });

        Ok(())
    }
}
