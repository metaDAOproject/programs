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
        let clock = Clock::get()?;

        require!(
            self.launch.state == LaunchState::Closed,
            LaunchpadError::InvalidLaunchState
        );

        let two_days_after_close = self
            .launch
            .unix_timestamp_closed
            .unwrap()
            .saturating_add(60 * 60 * 24 * 2);

        require_gt!(
            two_days_after_close,
            clock.unix_timestamp,
            LaunchpadError::FundingRecordApprovalPeriodOver
        );

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
