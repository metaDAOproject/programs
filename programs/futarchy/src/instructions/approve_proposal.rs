use super::*;

mod metadao_approver {
    use anchor_lang::prelude::declare_id;
    // METADAO_MULTISIG_VAULT (sdk/src/constants.ts)
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

#[derive(Accounts)]
#[event_cpi]
pub struct ApproveProposal<'info> {
    #[account(mut, has_one = dao)]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
    pub approver: Signer<'info>,
}

impl ApproveProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(
            self.approver.key(),
            metadao_approver::ID,
            FutarchyError::InvalidApprover
        );

        require!(
            matches!(self.proposal.state, ProposalState::Draft { .. }),
            FutarchyError::ProposalNotInDraftState
        );

        require_neq!(
            self.proposal.is_metadao_approved,
            true,
            FutarchyError::ProposalAlreadyApproved
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let Self {
            proposal,
            dao,
            approver,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        proposal.is_metadao_approved = true;

        dao.seq_num += 1;

        let clock = Clock::get()?;

        emit_cpi!(ApproveProposalEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            proposal: proposal.key(),
            dao: dao.key(),
            approver: approver.key(),
        });

        Ok(())
    }
}
