use super::*;

mod admin {
    use anchor_lang::prelude::declare_id;

    // MetaDAO ops multisig — the same signer as the approval enqueue
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct AdminUpdateProposalParamsArgs {
    pub duration_in_seconds: Option<u32>,
    pub pass_threshold_bps: Option<i16>,
}

#[derive(Accounts)]
#[event_cpi]
pub struct AdminUpdateProposalParams<'info> {
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,

    #[account(mut, has_one = dao)]
    pub proposal: Box<Account<'info, Proposal>>,

    pub admin: Signer<'info>,
}

impl AdminUpdateProposalParams<'_> {
    pub fn validate(&self, args: &AdminUpdateProposalParamsArgs) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(self.admin.key(), admin::ID, FutarchyError::InvalidAdmin);

        require!(self.dao.liquidator.is_none(), FutarchyError::DaoLiquidated);

        // Only arbitrary proposals can be modified
        require!(
            matches!(self.proposal.action, ProposalAction::ExecuteArbitrary),
            FutarchyError::InvalidProposalKind
        );

        // A live proposal's terms never move: the snapshot exists so later
        // changes can't shift the goalposts under it
        require!(
            matches!(self.proposal.state, ProposalState::Draft { .. }),
            FutarchyError::ProposalNotInDraftState
        );

        // An admin transaction that does nothing should fail
        require!(
            args.duration_in_seconds.is_some() || args.pass_threshold_bps.is_some(),
            FutarchyError::EmptyProposalParamsUpdate
        );

        if let Some(duration_in_seconds) = args.duration_in_seconds {
            // The same comparison `launch_proposal` makes
            require_gt!(
                duration_in_seconds,
                self.proposal.action.params().twap_start_delay_seconds,
                FutarchyError::ProposalDurationTooShort
            );
        }

        if let Some(pass_threshold_bps) = args.pass_threshold_bps {
            require_gte!(
                MAX_PROPOSAL_PASS_THRESHOLD_BPS,
                pass_threshold_bps,
                FutarchyError::InvalidProposalPassThreshold
            );
            require_gte!(
                pass_threshold_bps,
                MIN_PROPOSAL_PASS_THRESHOLD_BPS,
                FutarchyError::InvalidProposalPassThreshold
            );
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: AdminUpdateProposalParamsArgs) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let dao = &mut ctx.accounts.dao;

        let old_duration_in_seconds = proposal.duration_in_seconds;
        let old_pass_threshold_bps = proposal.pass_threshold_bps;

        if let Some(duration_in_seconds) = args.duration_in_seconds {
            proposal.duration_in_seconds = duration_in_seconds;
        }

        if let Some(pass_threshold_bps) = args.pass_threshold_bps {
            proposal.pass_threshold_bps = pass_threshold_bps;
        }

        dao.seq_num += 1;
        let clock = Clock::get()?;

        emit_cpi!(AdminUpdateProposalParamsEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            dao: dao.key(),
            proposal: proposal.key(),
            admin: ctx.accounts.admin.key(),
            old_duration_in_seconds,
            new_duration_in_seconds: proposal.duration_in_seconds,
            old_pass_threshold_bps,
            new_pass_threshold_bps: proposal.pass_threshold_bps,
        });

        Ok(())
    }
}
