use crate::{
    ChangeExecuted, ChangeRequest, ChangeType, CommonFields, PerformancePackage,
    PriceBasedPerformancePackageError, ProposerType,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ExecuteChange<'info> {
    #[account(
        mut,
        has_one = performance_package @ PriceBasedPerformancePackageError::InvalidChangeRequest,
        close = executor
    )]
    pub change_request: Account<'info, ChangeRequest>,

    #[account(mut)]
    pub performance_package: Account<'info, PerformancePackage>,

    /// The party executing the change (must be opposite of proposer)
    #[account(mut)]
    pub executor: Signer<'info>,
}

impl<'info> ExecuteChange<'info> {
    pub fn validate(&self) -> Result<()> {
        if self.change_request.proposer_type == ProposerType::Recipient {
            // If recipient proposed, locker authority must execute
            require_keys_eq!(
                self.executor.key(),
                self.performance_package.performance_package_authority,
                PriceBasedPerformancePackageError::UnauthorizedLockerAuthority
            );
        } else if self.change_request.proposer_type == ProposerType::Authority {
            // If authority proposed, recipient must execute
            require_keys_eq!(
                self.executor.key(),
                self.performance_package.recipient,
                PriceBasedPerformancePackageError::UnauthorizedChangeRequest
            );
        } else {
            // Proposer was neither valid party - should not happen due to proposal constraints
            return Err(PriceBasedPerformancePackageError::UnauthorizedChangeRequest.into());
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let performance_package = &mut ctx.accounts.performance_package;
        let change_request = &ctx.accounts.change_request;

        // Apply the change based on type
        match &change_request.change_type {
            ChangeType::Oracle { new_oracle_config } => {
                performance_package.oracle_config = *new_oracle_config;
            }
            ChangeType::Recipient { new_recipient } => {
                performance_package.recipient = *new_recipient;
            }
        }

        performance_package.seq_num += 1;
        // Emit event
        let clock = Clock::get()?;
        emit!(ChangeExecuted {
            common: CommonFields::new(&clock, performance_package.seq_num),
            performance_package: performance_package.key(),
            change_request: change_request.key(),
            executor: ctx.accounts.executor.key(),
            change_type: change_request.change_type.clone(),
        });

        Ok(())
    }
}
