use super::*;

pub mod admin {
    use anchor_lang::prelude::declare_id;

    // MetaDAO-controlled admin - cannot be a Squads signer because of reentrancy
    declare_id!("CWGawadYU8CzRVBecnJymNw97H7E3ndDinV5sMzesgY2");
}

#[derive(Accounts)]
#[event_cpi]
pub struct AdminApproveExecuteMultisigProposal<'info> {
    #[account(mut, has_one = squads_multisig)]
    pub dao: Account<'info, Dao>,
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: checked by futarchy program
    #[account(mut, seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_MULTISIG, dao.key().as_ref()], bump, seeds::program = squads_multisig_program)]
    pub squads_multisig: Account<'info, squads_multisig_program::Multisig>,
    /// CHECK: squads proposal, initialized by squads multisig program, checked by squads multisig program
    #[account(
        mut,
        seeds = [
            squads_multisig_program::SEED_PREFIX,
            squads_multisig.key().as_ref(),
            squads_multisig_program::SEED_TRANSACTION,
            squads_multisig_vault_transaction.index.to_le_bytes().as_ref(),
            squads_multisig_program::SEED_PROPOSAL,
        ],
        bump,
        seeds::program = squads_multisig_program
    )]
    pub squads_multisig_proposal: Account<'info, squads_multisig_program::Proposal>,
    /// CHECK: squads vault transaction, initialized by squads multisig program, checked by squads multisig program
    #[account(
        mut,
        seeds = [
            squads_multisig_program::SEED_PREFIX,
            squads_multisig.key().as_ref(),
            squads_multisig_program::SEED_TRANSACTION,
            squads_multisig_vault_transaction.index.to_le_bytes().as_ref(),
        ],
        bump,
        seeds::program = squads_multisig_program
    )]
    pub squads_multisig_vault_transaction:
        Account<'info, squads_multisig_program::VaultTransaction>,

    pub squads_multisig_program:
        Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
}

impl<'info, 'c: 'info> AdminApproveExecuteMultisigProposal<'info> {
    pub fn validate(&self) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(self.admin.key(), admin::ID, FutarchyError::InvalidAdmin);

        if !matches!(self.dao.amm.state, PoolState::Spot { .. }) {
            return Err(FutarchyError::PoolNotInSpotState.into());
        }

        if matches!(self.dao.optimistic_proposal, Some(_)) {
            return Err(FutarchyError::ActiveOptimisticProposalAlreadyEnqueued.into());
        }

        Ok(())
    }

    pub fn handle(ctx: Context<'_, '_, 'c, 'info, Self>) -> Result<()> {
        let Self {
            dao,
            admin: _,
            squads_multisig,
            squads_multisig_proposal,
            squads_multisig_vault_transaction,
            squads_multisig_program,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let dao_nonce = &dao.nonce.to_le_bytes();
        let dao_creator_key = &dao.dao_creator.as_ref();
        let dao_seeds = &[b"dao".as_ref(), dao_creator_key, dao_nonce, &[dao.pda_bump]];
        let dao_signer = &[&dao_seeds[..]];

        // Approve the proposal
        squads_multisig_program::cpi::proposal_approve(
            CpiContext::new_with_signer(
                squads_multisig_program.to_account_info(),
                squads_multisig_program::cpi::accounts::ProposalVote {
                    proposal: squads_multisig_proposal.to_account_info(),
                    multisig: squads_multisig.to_account_info(),
                    member: dao.to_account_info(),
                },
                dao_signer,
            ),
            squads_multisig_program::ProposalVoteArgs { memo: None },
        )?;

        // Execute the vault transaction
        squads_multisig_program::cpi::vault_transaction_execute(
            CpiContext::new_with_signer(
                squads_multisig_program.to_account_info(),
                squads_multisig_program::cpi::accounts::VaultTransactionExecute {
                    multisig: squads_multisig.to_account_info(),
                    proposal: squads_multisig_proposal.to_account_info(),
                    transaction: squads_multisig_vault_transaction.to_account_info(),
                    member: dao.to_account_info(),
                },
                dao_signer,
            )
            .with_remaining_accounts((&ctx.remaining_accounts).to_vec()),
        )?;

        Ok(())
    }
}
