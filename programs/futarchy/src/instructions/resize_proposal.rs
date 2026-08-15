use anchor_lang::{system_program, Discriminator};

use super::*;

#[derive(Accounts)]
pub struct ResizeProposal<'info> {
    /// CHECK: we check the discriminator
    #[account(mut)]
    pub proposal: UncheckedAccount<'info>,
    /// The proposal's DAO, checked against the deserialized proposal in the
    /// handler. Must already be migrated to the new layout (crank DAOs first).
    pub dao: Account<'info, Dao>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl ResizeProposal<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let proposal = &ctx.accounts.proposal;
        let dao = &ctx.accounts.dao;

        require_eq!(proposal.owner, &crate::ID);
        let is_discriminator_correct =
            proposal.try_borrow_data().unwrap()[..8] == Proposal::discriminator();
        require_eq!(is_discriminator_correct, true);

        const AFTER_REALLOC_SIZE: usize = Proposal::INIT_SPACE + 8;
        // 369 bytes: 2 (i16 pass_threshold_bps) + 1 (bool council_can_block)
        // + 366 (ProposalAction)
        const BEFORE_REALLOC_SIZE: usize = AFTER_REALLOC_SIZE - 369;

        if proposal.data_len() != BEFORE_REALLOC_SIZE {
            // already realloced
            require_eq!(proposal.data_len(), AFTER_REALLOC_SIZE);
            return Ok(());
        }

        let old_proposal_data =
            OldProposal::deserialize(&mut &proposal.try_borrow_data().unwrap()[8..])?;

        require_keys_eq!(old_proposal_data.dao, dao.key());

        let action = ProposalAction::ExecuteArbitrary;

        // Draft proposals take the kind's catalog params like any new proposal.
        // Launched proposals keep the rules they were launched under.
        let (pass_threshold_bps, duration_in_seconds) =
            if matches!(old_proposal_data.state, ProposalState::Draft { .. }) {
                let params = action.params();
                (params.pass_threshold_bps, params.duration_seconds)
            } else {
                let pass_threshold_bps = if old_proposal_data.is_team_sponsored {
                    dao.team_sponsored_pass_threshold_bps
                } else {
                    dao.pass_threshold_bps as i16
                };
                (pass_threshold_bps, old_proposal_data.duration_in_seconds)
            };

        let new_proposal_data = Proposal {
            number: old_proposal_data.number,
            proposer: old_proposal_data.proposer,
            timestamp_enqueued: old_proposal_data.timestamp_enqueued,
            state: old_proposal_data.state,
            base_vault: old_proposal_data.base_vault,
            quote_vault: old_proposal_data.quote_vault,
            dao: old_proposal_data.dao,
            pda_bump: old_proposal_data.pda_bump,
            question: old_proposal_data.question,
            duration_in_seconds,
            squads_proposal: old_proposal_data.squads_proposal,
            pass_base_mint: old_proposal_data.pass_base_mint,
            pass_quote_mint: old_proposal_data.pass_quote_mint,
            fail_base_mint: old_proposal_data.fail_base_mint,
            fail_quote_mint: old_proposal_data.fail_quote_mint,
            is_team_sponsored: old_proposal_data.is_team_sponsored,
            pass_threshold_bps,
            council_can_block: true,
            action,
        };

        proposal.realloc(AFTER_REALLOC_SIZE, true)?;

        let lamports_needed = Rent::get()?.minimum_balance(AFTER_REALLOC_SIZE);

        if lamports_needed > proposal.lamports() {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: proposal.to_account_info(),
                    },
                ),
                lamports_needed - proposal.lamports(),
            )?;
        }

        new_proposal_data.serialize(&mut &mut proposal.try_borrow_mut_data().unwrap()[8..])?;

        Ok(())
    }
}
