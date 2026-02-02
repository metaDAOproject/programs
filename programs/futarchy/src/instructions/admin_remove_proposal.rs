use super::*;

pub mod admin {
    use anchor_lang::prelude::declare_id;
    declare_id!("tSTp6B6kE9o6ZaTmHm2ZwnJBBtgd3x112tapxFhmBEQ");
}

#[derive(Accounts)]
#[event_cpi]
pub struct AdminRemoveProposal<'info> {
    #[account(mut, has_one = dao)]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

impl AdminRemoveProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(self.admin.key(), admin::ID, FutarchyError::InvalidAdmin);

        // TODO: See how we'd handle cancelling a proposal that has already been launched (in Pending state)
        require!(
            matches!(self.proposal.state, ProposalState::Draft { .. }),
            FutarchyError::ProposalNotInDraftState
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let dao = &mut ctx.accounts.dao;

        proposal.state = ProposalState::Removed;

        dao.seq_num += 1;
        let clock = Clock::get()?;

        emit_cpi!(RemoveProposalEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            proposal: proposal.key(),
            dao: dao.key(),
            admin: ctx.accounts.admin.key(),
        });

        Ok(())
    }
}
