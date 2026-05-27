use super::*;

#[derive(Accounts)]
pub struct ExecuteMultisigProposalApproval<'info> {
    #[account(mut, has_one = squads_multisig)]
    pub dao: Account<'info, Dao>,

    #[account(mut)]
    pub rent_receiver: Signer<'info>,

    #[account(
        mut,
        seeds = [
            squads_multisig_program::SEED_PREFIX,
            squads_multisig_program::SEED_MULTISIG,
            dao.key().as_ref(),
        ],
        bump,
        seeds::program = squads_multisig_program::ID,
    )]
    pub squads_multisig: Account<'info, squads_multisig_program::Multisig>,

    #[account(
        mut,
        seeds = [
            squads_multisig_program::SEED_PREFIX,
            squads_multisig.key().as_ref(),
            squads_multisig_program::SEED_TRANSACTION,
            enqueued_approval.transaction_index.to_le_bytes().as_ref(),
            squads_multisig_program::SEED_PROPOSAL,
        ],
        bump,
        seeds::program = squads_multisig_program::ID,
    )]
    pub squads_multisig_proposal: Account<'info, squads_multisig_program::Proposal>,

    #[account(
        mut,
        close = rent_receiver,
        has_one = dao,
        seeds = [
            SEED_ENQUEUED_MULTISIG_PROPOSAL_APPROVAL,
            dao.key().as_ref(),
            enqueued_approval.transaction_index.to_le_bytes().as_ref(),
        ],
        bump = enqueued_approval.pda_bump,
    )]
    pub enqueued_approval: Account<'info, EnqueuedMultisigProposalApproval>,

    pub squads_multisig_program:
        Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
}

impl ExecuteMultisigProposalApproval<'_> {
    pub fn validate(&self) -> Result<()> {
        if !matches!(self.dao.amm.state, PoolState::Spot { .. }) {
            return Err(FutarchyError::PoolNotInSpotState.into());
        }

        if self.dao.optimistic_proposal.is_some() {
            return Err(FutarchyError::ActiveOptimisticProposalAlreadyEnqueued.into());
        }

        validate_squads_proposal(
            &self.squads_multisig_proposal,
            &self.squads_multisig,
            &self.dao.squads_multisig,
            &self.dao.key(),
        )?;

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let Self {
            dao,
            rent_receiver: _,
            squads_multisig,
            squads_multisig_proposal,
            enqueued_approval: _,
            squads_multisig_program,
        } = ctx.accounts;

        let dao_nonce = &dao.nonce.to_le_bytes();
        let dao_creator_key = &dao.dao_creator.as_ref();
        let dao_seeds = &[SEED_DAO, dao_creator_key, dao_nonce, &[dao.pda_bump]];
        let dao_signer = &[&dao_seeds[..]];

        squads_multisig_program::cpi::proposal_approve(
            CpiContext::new_with_signer(
                squads_multisig_program.to_account_info(),
                squads_multisig_program::cpi::accounts::ProposalVote {
                    proposal: squads_multisig_proposal.to_account_info(),
                    multisig: squads_multisig.to_account_info(),
                    member: dao.to_account_info(),
                },
                dao_signer,
            ),
            squads_multisig_program::ProposalVoteArgs { memo: None },
        )?;

        Ok(())
    }
}
