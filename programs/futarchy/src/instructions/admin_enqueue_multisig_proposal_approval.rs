use super::*;

mod admin {
    use anchor_lang::prelude::declare_id;

    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct AdminEnqueueMultisigProposalApprovalArgs {
    pub transaction_index: u64,
}

#[derive(Accounts)]
#[instruction(args: AdminEnqueueMultisigProposalApprovalArgs)]
pub struct AdminEnqueueMultisigProposalApproval<'info> {
    #[account(has_one = squads_multisig)]
    pub dao: Account<'info, Dao>,

    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
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
        seeds = [
            squads_multisig_program::SEED_PREFIX,
            squads_multisig.key().as_ref(),
            squads_multisig_program::SEED_TRANSACTION,
            args.transaction_index.to_le_bytes().as_ref(),
            squads_multisig_program::SEED_PROPOSAL,
        ],
        bump,
        seeds::program = squads_multisig_program::ID,
    )]
    pub squads_multisig_proposal: Account<'info, squads_multisig_program::Proposal>,

    #[account(
        init,
        payer = admin,
        space = 8 + EnqueuedMultisigProposalApproval::INIT_SPACE,
        seeds = [
            SEED_ENQUEUED_MULTISIG_PROPOSAL_APPROVAL,
            dao.key().as_ref(),
            args.transaction_index.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub enqueued_approval: Account<'info, EnqueuedMultisigProposalApproval>,

    pub system_program: Program<'info, System>,
}

impl AdminEnqueueMultisigProposalApproval<'_> {
    pub fn validate(&self, _args: &AdminEnqueueMultisigProposalApprovalArgs) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(self.admin.key(), admin::ID, FutarchyError::InvalidAdmin);

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

    pub fn handle(
        ctx: Context<Self>,
        args: AdminEnqueueMultisigProposalApprovalArgs,
    ) -> Result<()> {
        let enqueued = &mut ctx.accounts.enqueued_approval;

        enqueued.dao = ctx.accounts.dao.key();
        enqueued.transaction_index = args.transaction_index;
        enqueued.pda_bump = ctx.bumps.enqueued_approval;

        Ok(())
    }
}

pub fn validate_squads_proposal(
    squads_proposal: &squads_multisig_program::Proposal,
    squads_multisig: &squads_multisig_program::Multisig,
    dao_multisig_key: &Pubkey,
    dao_key: &Pubkey,
) -> Result<()> {
    require_keys_eq!(squads_proposal.multisig, *dao_multisig_key);

    match squads_proposal.status {
        squads_multisig_program::ProposalStatus::Active { timestamp: _ } => {}
        _ => {
            msg!("squads proposal status: {:?}", squads_proposal.status);
            return Err(FutarchyError::InvalidSquadsProposalStatus.into());
        }
    }

    require_gt!(
        squads_proposal.transaction_index,
        squads_multisig.stale_transaction_index
    );

    require!(
        !squads_proposal.approved.contains(dao_key),
        FutarchyError::InvalidSquadsProposalStatus
    );

    Ok(())
}
