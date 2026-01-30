use anchor_lang::prelude::*;

use crate::{
    ChangeExecutedEvent, ChangeRequest, CommonFields, PackageStatus, PerformancePackage,
    PerformancePackageError, ProposerType,
};

#[derive(Accounts)]
pub struct ExecuteChange<'info> {
    #[account(mut)]
    pub performance_package: Account<'info, PerformancePackage>,

    #[account(
        mut,
        has_one = performance_package @ PerformancePackageError::ChangeRequestNotFound,
        close = rent_destination
    )]
    pub change_request: Account<'info, ChangeRequest>,

    pub executor: Signer<'info>,

    /// CHECK: Receives closed account rent
    #[account(mut)]
    pub rent_destination: UncheckedAccount<'info>,
}

impl ExecuteChange<'_> {
    pub fn validate(&self) -> Result<()> {
        let pp = &self.performance_package;
        let cr = &self.change_request;
        let executor = self.executor.key();

        // Executor must be the opposite party from the proposer
        match cr.proposer_type {
            ProposerType::Authority => {
                require_keys_eq!(
                    executor,
                    pp.recipient,
                    PerformancePackageError::InvalidExecutor
                );
            }
            ProposerType::Recipient => {
                require_keys_eq!(
                    executor,
                    pp.authority,
                    PerformancePackageError::InvalidExecutor
                );
            }
        }

        // Config changes (oracle/reward function) can only happen when Locked
        if cr.new_oracle_reader.is_some() || cr.new_reward_function.is_some() {
            require!(
                pp.status == PackageStatus::Locked,
                PerformancePackageError::NotLocked
            );
        }

        // Validate oracle reader if provided
        if let Some(ref oracle_reader) = cr.new_oracle_reader {
            oracle_reader.validate()?;
        }

        // Validate reward function if provided
        if let Some(ref reward_function) = cr.new_reward_function {
            reward_function.validate()?;
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let pp = &mut ctx.accounts.performance_package;
        let cr = &ctx.accounts.change_request;
        let executor = ctx.accounts.executor.key();

        // Apply all Some fields from change_request
        if let Some(new_recipient) = cr.new_recipient {
            pp.recipient = new_recipient;
        }

        if let Some(ref new_oracle_reader) = cr.new_oracle_reader {
            pp.oracle_reader = new_oracle_reader.clone();
        }

        if let Some(ref new_reward_function) = cr.new_reward_function {
            pp.reward_function = new_reward_function.clone();
        }

        // Increment seq_num for event tracking
        pp.seq_num += 1;

        let clock = Clock::get()?;

        emit!(ChangeExecutedEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
                performance_package_seq_num: pp.seq_num,
            },
            performance_package: pp.key(),
            executed_by: executor,
            new_recipient: cr.new_recipient,
            new_oracle_reader: cr.new_oracle_reader.clone(),
            new_reward_function: cr.new_reward_function.clone(),
        });

        // The change_request account is closed automatically via the `close = rent_destination` constraint

        Ok(())
    }
}
