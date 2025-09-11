use anchor_lang::prelude::*;
use crate::{ChangeRequest, ChangeType, Locker, LockerState, PriceBasedUnlockError};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ProposeChangeParams {
    pub change_type: ChangeType,
    pub create_key: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: ProposeChangeParams)]
pub struct ProposeChange<'info> {
    #[account(
        init_if_needed,
        payer = proposer,
        space = 8 + ChangeRequest::INIT_SPACE,
        seeds = [
            b"change_request",
            locker.key().as_ref(),
            params.create_key.as_ref()
        ],
        bump
    )]
    pub change_request: Account<'info, ChangeRequest>,

    #[account(mut)]
    pub locker: Account<'info, Locker>,

    #[account(mut)]
    pub proposer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> ProposeChange<'info> {
    pub fn validate(&self) -> Result<()> {
        if self.proposer.key() != self.locker.token_recipient && self.proposer.key() != self.locker.locker_authority {
            msg!("proposer ({}) is not the token recipient ({}) or locker authority ({})", self.proposer.key(), self.locker.token_recipient, self.locker.locker_authority);
            return Err(PriceBasedUnlockError::UnauthorizedChangeRequest.into());
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: ProposeChangeParams) -> Result<()> {
        let change_request = &mut ctx.accounts.change_request;
        let locker = &mut ctx.accounts.locker;
        let clock = Clock::get()?;

        // Store the current state before changing it and locker key
        let previous_state = locker.state.clone();
        let locker_key = locker.key();

        change_request.locker = locker_key;
        change_request.change_type = params.change_type;
        change_request.proposed_at = clock.unix_timestamp;
        change_request.previous_state = previous_state;
        change_request.proposer = ctx.accounts.proposer.key();
        change_request.create_key = params.create_key;
        change_request.pda_bump = ctx.bumps.change_request;

        // Update locker state to indicate pending change
        locker.state = LockerState::PendingChange {
            change_request: change_request.key(),
        };

        Ok(())
    }
}