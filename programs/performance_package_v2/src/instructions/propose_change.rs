use anchor_lang::prelude::*;

use crate::{
    ChangeProposedEvent, ChangeRequest, CommonFields, OracleReader, PerformancePackage,
    PerformancePackageError, ProposerType, RewardFunction, CHANGE_REQUEST_SEED,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProposeChangeArgs {
    pub pda_nonce: u32,
    pub new_recipient: Option<Pubkey>,
    pub new_oracle_reader: Option<OracleReader>,
    pub new_reward_function: Option<RewardFunction>,
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(args: ProposeChangeArgs)]
pub struct ProposeChange<'info> {
    #[account(mut)]
    pub performance_package: Account<'info, PerformancePackage>,

    #[account(
        init,
        payer = payer,
        space = 8 + ChangeRequest::INIT_SPACE,
        seeds = [
            CHANGE_REQUEST_SEED,
            performance_package.key().as_ref(),
            proposer.key().as_ref(),
            args.pda_nonce.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub change_request: Account<'info, ChangeRequest>,

    pub proposer: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl ProposeChange<'_> {
    pub fn validate(&self, args: &ProposeChangeArgs) -> Result<()> {
        let pp = &self.performance_package;

        // Signer must be authority or recipient
        require!(
            self.proposer.key() == pp.authority || self.proposer.key() == pp.recipient,
            PerformancePackageError::Unauthorized
        );

        // At least one change must be proposed
        require!(
            args.new_recipient.is_some()
                || args.new_oracle_reader.is_some()
                || args.new_reward_function.is_some(),
            PerformancePackageError::NoChangesProposed
        );

        // Validate oracle config if provided
        if let Some(ref oracle) = args.new_oracle_reader {
            oracle.validate()?;
        }

        // Validate reward function if provided
        if let Some(ref reward_fn) = args.new_reward_function {
            reward_fn.validate()?;
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: ProposeChangeArgs) -> Result<()> {
        let pp = &mut ctx.accounts.performance_package;
        let proposer_key = ctx.accounts.proposer.key();

        // Determine proposer type
        // Authority could theoretically change during change proposal,
        // so we need this ProposerType to know who needs to sign the change request.
        let proposer_type = if proposer_key == pp.authority {
            ProposerType::Authority
        } else {
            ProposerType::Recipient
        };

        let clock = Clock::get()?;

        // Initialize the change request
        ctx.accounts.change_request.set_inner(ChangeRequest {
            performance_package: pp.key(),
            proposer_type,
            proposer: proposer_key,
            pp_created_at_timestamp: pp.created_at_timestamp,
            proposed_at: clock.unix_timestamp,
            pda_nonce: args.pda_nonce,
            bump: ctx.bumps.change_request,
            new_recipient: args.new_recipient,
            new_oracle_reader: args.new_oracle_reader.clone(),
            new_reward_function: args.new_reward_function.clone(),
        });

        // Increment seq_num for event tracking
        pp.seq_num += 1;

        emit_cpi!(ChangeProposedEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
                performance_package_seq_num: pp.seq_num,
            },
            performance_package: pp.key(),
            change_request: ctx.accounts.change_request.key(),
            proposer_type,
            pda_nonce: args.pda_nonce,
            new_recipient: args.new_recipient,
            new_oracle_reader: args.new_oracle_reader,
            new_reward_function: args.new_reward_function,
        });

        Ok(())
    }
}
