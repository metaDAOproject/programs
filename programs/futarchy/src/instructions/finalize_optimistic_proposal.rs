use super::*;

#[derive(Accounts)]
#[event_cpi]
pub struct FinalizeOptimisticProposal<'info> {
    #[account(mut, seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_MULTISIG, dao.key().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig: Account<'info, squads_multisig_program::Multisig>,
    #[account(mut)]
    pub squads_proposal: Box<Account<'info, squads_multisig_program::Proposal>>,

    #[account(mut, has_one = squads_multisig)]
    pub dao: Box<Account<'info, Dao>>,

    pub squads_program: Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
}

impl FinalizeOptimisticProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.dao.optimistic_proposal.is_some(),
            FutarchyError::NoActiveOptimisticProposal
        );
        let optimistic_proposal = self.dao.optimistic_proposal.as_ref().unwrap();

        require_keys_eq!(
            self.squads_proposal.key(),
            optimistic_proposal.squads_proposal
        );
        require_keys_eq!(self.squads_proposal.multisig, self.dao.squads_multisig);

        // A minimum of proposal duration must have passed since the optimistic proposal was enqueued
        require_gte!(
            Clock::get()?.unix_timestamp,
            optimistic_proposal.enqueued_timestamp + self.dao.seconds_per_proposal as i64,
            FutarchyError::ProposalTooYoung
        );

        // Pool must be in spot state - no active proposals
        // This should never be hit, but it's here for completeness
        require!(
            matches!(self.dao.amm.state, PoolState::Spot { .. }),
            FutarchyError::PoolNotInSpotState
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let Self {
            squads_multisig,
            squads_proposal,
            dao,
            event_authority: _,
            program: _,
            squads_program,
        } = ctx.accounts;

        let dao_nonce = &dao.nonce.to_le_bytes();
        let dao_creator_key = dao.dao_creator.as_ref();
        let dao_seeds = &[b"dao".as_ref(), dao_creator_key, dao_nonce, &[dao.pda_bump]];

        let dao_signer = &[&dao_seeds[..]];

        squads_multisig_program::cpi::proposal_approve(
            CpiContext::new_with_signer(
                squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::ProposalVote {
                    proposal: squads_proposal.to_account_info(),
                    multisig: squads_multisig.to_account_info(),
                    member: dao.to_account_info(), // DAO can approve the proposal
                },
                dao_signer,
            ),
            squads_multisig_program::ProposalVoteArgs { memo: None },
        )?;

        // Update the DAO state
        dao.optimistic_proposal = None;
        dao.seq_num += 1;

        emit_cpi!(FinalizeOptimisticProposalEvent {
            common: CommonFields::new(&Clock::get()?, dao.seq_num),
            dao: dao.key(),
            squads_proposal: squads_proposal.key(),
        });

        Ok(())
    }
}
