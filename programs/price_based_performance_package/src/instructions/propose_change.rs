use crate::{
    ChangeProposed, ChangeRequest, ChangeType, PerformancePackage, PerformancePackageState,
    PriceBasedPerformancePackageError, ProposerType,
};
use anchor_lang::prelude::*;

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
        init,
        payer = payer,
        space = 8 + ChangeRequest::INIT_SPACE,
        seeds = [
            b"change_request",
            performance_package.key().as_ref(),
            proposer.key().as_ref(),
            params.pda_nonce.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub change_request: Account<'info, ChangeRequest>,
    #[account(mut)]
    pub performance_package: Account<'info, PerformancePackage>,
    pub proposer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> ProposeChange<'info> {
    pub fn validate(&self, params: &ProposeChangeParams) -> Result<()> {
        if self.proposer.key() != self.performance_package.recipient
            && self.proposer.key() != self.performance_package.performance_package_authority
        {
            msg!("proposer ({}) is not the token recipient ({}) or performance package authority ({})", self.proposer.key(), self.performance_package.recipient, self.performance_package.performance_package_authority);
            return Err(PriceBasedPerformancePackageError::UnauthorizedChangeRequest.into());
        }

        // Disallow oracle changes while in Unlocking state to prevent TWAP corruption
        if matches!(params.change_type, ChangeType::Oracle { .. })
            && matches!(
                self.performance_package.state,
                PerformancePackageState::Unlocking { .. }
            )
        {
            return Err(PriceBasedPerformancePackageError::InvalidPerformancePackageState.into());
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: ProposeChangeParams) -> Result<()> {
        let Self {
            change_request,
            performance_package,
            proposer,
            payer: _,
            system_program: _,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let ProposeChangeParams {
            change_type,
            pda_nonce,
        } = params;

        let proposer_type = if proposer.key() == performance_package.recipient {
            ProposerType::Recipient
        } else if proposer.key() == performance_package.performance_package_authority {
            ProposerType::Authority
        } else {
            unreachable!()
        };

        let clock = Clock::get()?;

        change_request.set_inner(ChangeRequest {
            performance_package: performance_package.key(),
            change_type: change_type.clone(),
            proposed_at: clock.unix_timestamp,
            proposer_type,
            pda_nonce: pda_nonce,
            pda_bump: ctx.bumps.change_request,
        });

        // Emit event
        emit!(ChangeProposed {
            locker: performance_package.key(),
            change_request: change_request.key(),
            proposer: proposer.key(),
            change_type,
        });

        Ok(())
    }
}
