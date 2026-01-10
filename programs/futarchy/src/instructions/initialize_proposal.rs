use super::*;

#[derive(Accounts)]
#[event_cpi]
pub struct InitializeProposal<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [b"proposal", squads_proposal.key().as_ref()],
        bump
    )]
    pub proposal: Box<Account<'info, Proposal>>,
    pub squads_proposal: Box<Account<'info, squads_multisig_program::Proposal>>,
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(
        constraint = question.oracle == proposal.key()
    )]
    pub question: Box<Account<'info, Question>>,
    #[account(
        constraint = quote_vault.underlying_token_mint == dao.quote_mint,
        has_one = question,
    )]
    pub quote_vault: Box<Account<'info, ConditionalVault>>,
    #[account(
        constraint = base_vault.underlying_token_mint == dao.base_mint,
        has_one = question,
    )]
    pub base_vault: Box<Account<'info, ConditionalVault>>,
    pub proposer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl InitializeProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        // If we're trying to challenge an optimistic proposal that has already passed due to age, we should error
        // This is because the optimistic proposal's Squads proposal will eventually have to be executed
        match self.dao.optimistic_proposal {
            Some(ref optimistic_proposal) => {
                if optimistic_proposal.squads_proposal == self.squads_proposal.key() {
                    require_gt!(
                        optimistic_proposal.enqueued_timestamp
                            + self.dao.seconds_per_proposal as i64,
                        Clock::get()?.unix_timestamp,
                        FutarchyError::OptimisticProposalAlreadyPassed
                    );
                }
            }
            None => {}
        }

        require_eq!(
            self.question.num_outcomes(),
            2,
            FutarchyError::QuestionMustBeBinary
        );

        require_keys_eq!(self.squads_proposal.multisig, self.dao.squads_multisig);

        match self.squads_proposal.status {
            squads_multisig_program::ProposalStatus::Active { timestamp: _ } => {}
            _ => {
                msg!("squads proposal status: {:?}", self.squads_proposal.status);
                return Err(FutarchyError::InvalidSquadsProposalStatus.into());
            }
        }

        // Should never be the case because the oracle is the proposal account, and you can't re-initialize a proposal
        assert!(!self.question.is_resolved());

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let Self {
            base_vault,
            quote_vault,
            question,
            proposal,
            squads_proposal,
            dao,
            proposer,
            payer: _,
            system_program: _,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let clock = Clock::get()?;

        dao.proposal_count += 1;

        proposal.set_inner(Proposal {
            number: dao.proposal_count,
            squads_proposal: squads_proposal.key(),
            proposer: proposer.key(),
            timestamp_enqueued: 0,
            state: ProposalState::Draft { amount_staked: 0 },
            base_vault: base_vault.key(),
            quote_vault: quote_vault.key(),
            dao: dao.key(),
            pda_bump: ctx.bumps.proposal,
            question: question.key(),
            duration_in_seconds: dao.seconds_per_proposal,
            pass_base_mint: base_vault.conditional_token_mints[1],
            fail_base_mint: base_vault.conditional_token_mints[0],
            pass_quote_mint: quote_vault.conditional_token_mints[1],
            fail_quote_mint: quote_vault.conditional_token_mints[0],
            is_team_sponsored: false,
        });

        dao.seq_num += 1;

        emit_cpi!(InitializeProposalEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            proposal: proposal.key(),
            dao: dao.key(),
            question: question.key(),
            base_vault: base_vault.key(),
            quote_vault: quote_vault.key(),
            proposer: proposer.key(),
            number: dao.proposal_count,
            pda_bump: ctx.bumps.proposal,
            duration_in_seconds: proposal.duration_in_seconds,
            squads_proposal: squads_proposal.key(),
            squads_multisig: dao.squads_multisig,
            squads_multisig_vault: dao.squads_multisig_vault,
        });

        Ok(())
    }
}
