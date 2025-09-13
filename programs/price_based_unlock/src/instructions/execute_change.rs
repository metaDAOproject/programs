use anchor_lang::prelude::*;
use crate::{ChangeRequest, ChangeType, Locker, PriceBasedUnlockError};

#[derive(Accounts)]
#[event_cpi]
pub struct ExecuteChange<'info> {
    #[account(
        mut,
        constraint = change_request.locker == locker.key() @ PriceBasedUnlockError::InvalidChangeRequest,
        close = executor
    )]
    pub change_request: Account<'info, ChangeRequest>,

    #[account(mut)]
    pub locker: Account<'info, Locker>,

    /// The party executing the change (must be opposite of proposer)
    #[account(mut)]
    pub executor: Signer<'info>,
}

impl<'info> ExecuteChange<'info> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let locker = &mut ctx.accounts.locker;
        let change_request = &ctx.accounts.change_request;

        // Dynamic validation: executor must be the opposite party from who proposed
        let executor_key = ctx.accounts.executor.key();
        let proposer_key = change_request.proposer;
        
        if proposer_key == locker.token_recipient {
            // If recipient proposed, locker authority must execute
            require!(
                executor_key == locker.locker_authority,
                PriceBasedUnlockError::UnauthorizedLockerAuthority
            );
        } else if proposer_key == locker.locker_authority {
            // If locker authority proposed, recipient must execute
            require!(
                executor_key == locker.token_recipient,
                PriceBasedUnlockError::UnauthorizedChangeRequest
            );
        } else {
            // Proposer was neither valid party - should not happen due to proposal constraints
            return Err(PriceBasedUnlockError::UnauthorizedChangeRequest.into());
        }

        // Get the previous state from the change request
        let previous_state = change_request.previous_state.clone();

        // Apply the change based on type
        match &change_request.change_type {
            ChangeType::Oracle { new_oracle_config } => {
                locker.oracle_config = *new_oracle_config;
            }
            ChangeType::Recipient { new_recipient } => {
                locker.token_recipient = *new_recipient;
            }
        }

        // Restore previous state
        locker.state = previous_state;

        // Emit event
        let clock = Clock::get()?;
        emit_cpi!(crate::events::ChangeExecuted {
            locker: locker.key(),
            change_request: change_request.key(),
            executor: ctx.accounts.executor.key(),
            change_type: change_request.change_type.clone(),
            executed_at: clock.unix_timestamp,
        });

        Ok(())
    }
}