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
        require!(self.dao.liquidator.is_none(), FutarchyError::DaoLiquidated);

        require!(
            matches!(self.proposal.state, ProposalState::Draft { .. }),
            FutarchyError::ProposalNotInDraftState
        );

        require!(
            self.proposal.action.params().team_sponsorship_policy
                != TeamSponsorshipPolicy::Forbidden,
            FutarchyError::TeamSponsorshipForbidden
        );

        // A previous team's sponsorship can be replaced, the current team's can't be repeated.
        require!(
            !self.proposal.is_sponsored_by(self.dao.team_address),
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

        proposal.sponsored_by = Some(team_address.key());

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
