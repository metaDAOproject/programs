use anchor_lang::prelude::*;

use crate::error::LaunchpadError;
use crate::events::{CommonFields, FundingRecordApprovalSetEvent};
use crate::state::{FundingRecord, Launch, LaunchState};

#[event_cpi]
#[derive(Accounts)]
pub struct SetFundingRecordApproval<'info> {
    #[account(
        mut,
        has_one = launch_authority,
    )]
    pub launch: Account<'info, Launch>,

    #[account(
        mut,
        has_one = launch,
    )]
    pub funding_record: Account<'info, FundingRecord>,

    pub launch_authority: Signer<'info>,
}

impl SetFundingRecordApproval<'_> {
    pub fn validate(&self, approved_amount: u64) -> Result<()> {
        // We can only set approval amounts for a launch that is live, but not accepting new contributions

        require!(
            self.launch.state == LaunchState::Live,
            LaunchpadError::LaunchNotLive
        );

        let clock = Clock::get()?;

        // Check that the launch funding period is over (not accepting new contributions)
        require_gte!(
            clock.unix_timestamp,
            self.launch
                .unix_timestamp_started
                .unwrap()
                .saturating_add(self.launch.seconds_for_launch.try_into().unwrap()),
            LaunchpadError::LaunchPeriodNotOver
        );

        // Can't approve more than the committed amount
        require_gte!(
            self.funding_record.committed_amount,
            approved_amount,
            LaunchpadError::InsufficientFunds
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, approved_amount: u64) -> Result<()> {
        let funding_record = &mut ctx.accounts.funding_record;
        let launch = &mut ctx.accounts.launch;

        if approved_amount >= funding_record.approved_amount {
            launch.total_approved_amount += approved_amount - funding_record.approved_amount;
        } else {
            launch.total_approved_amount -= funding_record.approved_amount - approved_amount;
        }

        launch.seq_num += 1;

        funding_record.approved_amount = approved_amount;

        let clock = Clock::get()?;
        emit_cpi!(FundingRecordApprovalSetEvent {
            common: CommonFields::new(&clock, launch.seq_num),
            launch: launch.key(),
            funding_record: funding_record.key(),
            funder: funding_record.funder,
            approved_amount,
            total_approved: launch.total_approved_amount,
        });

        Ok(())
    }
}
