use super::*;

use anchor_lang::Discriminator;
use squads_multisig_program::program::SquadsMultisigProgram;

#[derive(Accounts)]
pub struct ExecuteSpendingLimitChange<'info> {
    #[account(
        mut, has_one = dao, has_one = squads_proposal,
    )]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(mut, has_one = squads_multisig)]
    pub dao: Box<Account<'info, Dao>>,
    /// CHECK: checked by squads multisig program
    #[account(mut)]
    pub squads_proposal: Account<'info, squads_multisig_program::Proposal>,
    #[account(address = vault_transaction.multisig)]
    pub squads_multisig: Account<'info, squads_multisig_program::Multisig>,
    pub squads_multisig_program: Program<'info, SquadsMultisigProgram>,
    pub vault_transaction: Account<'info, squads_multisig_program::VaultTransaction>,
}

impl<'info, 'c: 'info> ExecuteSpendingLimitChange<'info> {
    pub fn validate(&self) -> Result<()> {
        require_eq!(self.proposal.state, ProposalState::Passed);

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
            proposal: _,
            dao,
            squads_proposal,
            squads_multisig,
            squads_multisig_program,
            vault_transaction,
        } = ctx.accounts;

        let message = &vault_transaction.message;

        // it would be bad if we signed with the Dao and then they ran off and did something else
        // with it. so we verify that the only instructions are calls to update spending limits on
        // the squads program
        let squads_program_key_index: u8 = message
            .account_keys
            .iter()
            .position(|key| key == &squads_multisig_program.key())
            .ok_or(error!(FutarchyError::InvalidTransaction))?
            .try_into()
            .or_else(|_| Err(error!(FutarchyError::InvalidTransaction)))?;

        for instruction in message.instructions.iter() {
            require_eq!(
                instruction.program_id_index,
                squads_program_key_index,
                FutarchyError::InvalidTransaction
            );

            let discriminator: [u8; 8] = instruction.data[0..8].try_into().unwrap();
            if discriminator != squads_multisig_program::instruction::MultisigAddSpendingLimit::DISCRIMINATOR &&
                discriminator != squads_multisig_program::instruction::MultisigRemoveSpendingLimit::DISCRIMINATOR {
                return Err(error!(FutarchyError::InvalidTransaction));
            }
        }

        let dao_nonce = &dao.nonce.to_le_bytes();
        let dao_creator_key = &dao.dao_creator.as_ref();
        let dao_seeds = &[SEED_DAO, dao_creator_key, dao_nonce, &[dao.pda_bump]];
        let dao_signer = &[&dao_seeds[..]];

        squads_multisig_program::cpi::vault_transaction_execute(
            CpiContext::new_with_signer(
                squads_multisig_program.to_account_info(),
                squads_multisig_program::cpi::accounts::VaultTransactionExecute {
                    multisig: squads_multisig.to_account_info(),
                    proposal: squads_proposal.to_account_info(),
                    transaction: vault_transaction.to_account_info(),
                    member: dao.to_account_info(),
                },
                dao_signer,
            )
            .with_remaining_accounts((&ctx.remaining_accounts).to_vec()),
        )?;

        Ok(())
    }
}
