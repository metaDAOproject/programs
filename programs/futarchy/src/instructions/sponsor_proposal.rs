use super::*;

#[derive(Accounts)]
#[event_cpi]
pub struct SponsorProposal<'info> {
    #[account(mut, has_one = dao)]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(mut, has_one = team_address)]
    pub dao: Box<Account<'info, Dao>>,
    pub team_address: Signer<'info>,
}

impl SponsorProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            matches!(self.proposal.state, ProposalState::Draft { .. }),
            FutarchyError::ProposalNotInDraftState
        );

        require_neq!(
            self.proposal.is_team_sponsored,
            true,
            FutarchyError::ProposalAlreadySponsored
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let Self {
            proposal,
            dao,
            team_address,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        proposal.is_team_sponsored = true;

        dao.seq_num += 1;

        let clock = Clock::get()?;

        emit_cpi!(SponsorProposalEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            proposal: proposal.key(),
            dao: dao.key(),
            team_address: team_address.key(),
        });

        Ok(())
    }
}
