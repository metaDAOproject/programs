use anchor_lang::prelude::*;
use crate::{ChangeRequest, ChangeType, Locker, PriceBasedUnlockError};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ProposeChangeParams {
    pub change_type: ChangeType,
    pub pda_nonce: u32,
}

#[derive(Accounts)]
#[instruction(params: ProposeChangeParams)]
#[event_cpi]
pub struct ProposeChange<'info> {
    #[account(
        init_if_needed,
        payer = proposer,
        space = 8 + ChangeRequest::INIT_SPACE,
        seeds = [
            b"change_request",
            locker.key().as_ref(),
            proposer.key().as_ref(),
            params.pda_nonce.to_le_bytes().as_ref()
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
        let Self {
            change_request,
            locker,
            proposer,
            system_program: _,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let ProposeChangeParams {
            change_type,
            pda_nonce,
        } = params;

        let clock = Clock::get()?;

        // Store the current state before changing it and locker key
        let previous_state = locker.state.clone();

        change_request.set_inner(ChangeRequest {
            locker: locker.key(),
            change_type: change_type.clone(),
            proposed_at: clock.unix_timestamp,
            previous_state,
            proposer: proposer.key(),
            pda_nonce: pda_nonce,
            pda_bump: ctx.bumps.change_request,
        });
        
        // Emit event
        emit!(crate::events::ChangeProposed {
            locker: locker.key(),
            change_request: change_request.key(),
            proposer: proposer.key(),
            change_type,
            proposed_at: clock.unix_timestamp,
        });

        Ok(())
    }
}