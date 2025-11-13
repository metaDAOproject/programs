// use anchor_lang::solana_program::system_program;
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
        let proposal = &mut ctx.accounts.proposal;

        require_eq!(proposal.owner, &ID);
        let is_discriminator_correct =
            proposal.data.try_borrow_mut().unwrap()[..8] == Proposal::discriminator();
        require_eq!(is_discriminator_correct, true);

        const AFTER_REALLOC_SIZE: usize = Proposal::INIT_SPACE + 8;
        const BEFORE_REALLOC_SIZE: usize = AFTER_REALLOC_SIZE - 1; // 1 for `is_team_sponsored`

        if proposal.data_len() != BEFORE_REALLOC_SIZE {
            // already realloced
            require_eq!(proposal.data_len(), AFTER_REALLOC_SIZE);
            return Ok(());
        }

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

        let mut proposal_data =
            Proposal::deserialize(&mut &proposal.try_borrow_mut_data().unwrap()[8..])?;

        proposal_data.is_team_sponsored = false;

        proposal_data.serialize(&mut &mut proposal.try_borrow_mut_data().unwrap()[8..])?;

        Ok(())
    }
}
