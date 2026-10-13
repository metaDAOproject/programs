use anchor_lang::{system_program, Discriminator};

use super::*;

#[derive(Accounts)]
pub struct ResizeProposal<'info> {
    /// CHECK: we check the discriminator
    #[account(mut)]
    pub proposal: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl ResizeProposal<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let proposal = &ctx.accounts.proposal;

        require_eq!(proposal.owner, &crate::ID);
        let is_discriminator_correct =
            proposal.try_borrow_data().unwrap()[..8] == Proposal::discriminator();
        require_eq!(is_discriminator_correct, true);

        const AFTER_REALLOC_SIZE: usize = Proposal::INIT_SPACE + 8;
        // 1 byte: is_metadao_approved (bool)
        const BEFORE_REALLOC_SIZE: usize = AFTER_REALLOC_SIZE - 1;

        if proposal.data_len() != BEFORE_REALLOC_SIZE {
            // already realloced
            require_eq!(proposal.data_len(), AFTER_REALLOC_SIZE);
            return Ok(());
        }

        let old_proposal_data =
            OldProposal::deserialize(&mut &proposal.try_borrow_data().unwrap()[8..])?;

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
            duration_in_seconds: old_proposal_data.duration_in_seconds,
            squads_proposal: old_proposal_data.squads_proposal,
            pass_base_mint: old_proposal_data.pass_base_mint,
            pass_quote_mint: old_proposal_data.pass_quote_mint,
            fail_base_mint: old_proposal_data.fail_base_mint,
            fail_quote_mint: old_proposal_data.fail_quote_mint,
            is_team_sponsored: old_proposal_data.is_team_sponsored,
            is_metadao_approved: false,
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
