use super::*;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct InitiateVaultSpendOptimisticProposalParams {
    pub amount: u64,
}

#[derive(Accounts)]
#[event_cpi]
pub struct InitiateVaultSpendOptimisticProposal<'info> {
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_MULTISIG, dao.key().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig: Account<'info, squads_multisig_program::Multisig>,

    /// CHECK: The squads multisig vault that executes the transaction
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_VAULT, 0_u8.to_le_bytes().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig_vault: UncheckedAccount<'info>,

    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_SPENDING_LIMIT, dao.key().as_ref()], bump, seeds::program = squads_program)]
    pub squads_spending_limit: Account<'info, squads_multisig_program::SpendingLimit>,

    #[account(constraint = squads_proposal.multisig == squads_multisig.key() @ FutarchyError::InvalidTransaction)]
    pub squads_proposal: Account<'info, squads_multisig_program::Proposal>,

    #[account(constraint = squads_vault_transaction.multisig == squads_multisig.key() @ FutarchyError::InvalidTransaction)]
    pub squads_vault_transaction: Account<'info, squads_multisig_program::VaultTransaction>,

    #[account(mut, has_one = squads_multisig, has_one = squads_multisig_vault)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(associated_token::mint = dao.quote_mint, associated_token::authority = dao.squads_multisig_vault)]
    pub dao_quote_vault_account: Account<'info, TokenAccount>,

    // Only the team can initiate an optimistic proposal
    #[account(address = dao.team_address)]
    pub proposer: Signer<'info>,

    /// CHECK: Used for constraints
    pub recipient: UncheckedAccount<'info>,
    #[account(associated_token::mint = dao.quote_mint, associated_token::authority = recipient)]
    pub recipient_quote_account: Account<'info, TokenAccount>,

    pub squads_program: Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
    pub token_program: Program<'info, Token>,
}

impl InitiateVaultSpendOptimisticProposal<'_> {
    pub fn validate(&self, params: &InitiateVaultSpendOptimisticProposalParams) -> Result<()> {
        // Optimistic governance must be enabled
        require!(
            self.dao.is_optimistic_governance_enabled,
            FutarchyError::OptimisticGovernanceDisabled
        );

        // Pool must be in spot state - no active proposal
        require!(
            matches!(self.dao.amm.state, PoolState::Spot { spot: _ }),
            FutarchyError::PoolNotInSpotState
        );

        // No existing optimistic proposal can be present. If one has passed, it can be finalized (finalize_optimistic_proposal)
        require!(
            self.dao.optimistic_proposal.is_none(),
            FutarchyError::ActiveOptimisticProposalAlreadyEnqueued
        );

        // Spending limit mint must be the same as the DAO's quote mint
        require_eq!(
            self.squads_spending_limit.mint,
            self.dao.quote_mint,
            FutarchyError::InvalidSpendingLimitMint
        );

        // Amount must be less than or equal to 3 times the spending limit
        require_gte!(
            self.squads_spending_limit.amount.saturating_mul(3),
            params.amount,
            FutarchyError::InvalidAmount
        );

        // Validate the squads proposal is Active
        require!(
            matches!(
                self.squads_proposal.status,
                squads_multisig_program::ProposalStatus::Active { .. }
            ),
            FutarchyError::InvalidSquadsProposalStatus
        );

        // Proposal must be fresh: no votes recorded yet
        require!(
            self.squads_proposal.approved.is_empty(),
            FutarchyError::InvalidTransaction
        );
        require!(
            self.squads_proposal.rejected.is_empty(),
            FutarchyError::InvalidTransaction
        );
        require!(
            self.squads_proposal.cancelled.is_empty(),
            FutarchyError::InvalidTransaction
        );

        // Ensure the squads proposal is not invalidated by a previous config transaction
        require_gt!(
            self.squads_proposal.transaction_index,
            self.squads_multisig.stale_transaction_index
        );

        // Ensure the vault transaction was created by the permissionless account
        require_keys_eq!(
            self.squads_vault_transaction.creator,
            permissionless_account::id(),
            FutarchyError::InvalidTransaction
        );

        // Validate the proposal references the vault transaction
        require_eq!(
            self.squads_proposal.transaction_index,
            self.squads_vault_transaction.index,
            FutarchyError::InvalidTransaction
        );

        // Must target vault index 0
        require_eq!(
            self.squads_vault_transaction.vault_index,
            0,
            FutarchyError::InvalidTransaction
        );

        // No ephemeral signers for SPL transfer
        require!(
            self.squads_vault_transaction
                .ephemeral_signer_bumps
                .is_empty(),
            FutarchyError::InvalidTransaction
        );

        // Validate the vault transaction message contains exactly the expected SPL transfer
        let message = &self.squads_vault_transaction.message;

        // Exactly 1 signer (the vault, which is both the payer and the SPL Transfer authority)
        require_eq!(message.num_signers, 1_u8, FutarchyError::InvalidTransaction);

        // First account key (sole signer) must be the vault
        let first_signer = message
            .account_keys
            .first()
            .ok_or(error!(FutarchyError::InvalidTransaction))?;
        require_keys_eq!(
            *first_signer,
            self.squads_multisig_vault.key(),
            FutarchyError::InvalidTransaction
        );

        // Vault is a writable signer (TransactionMessage always marks the payerKey as writable)
        require_eq!(
            message.num_writable_signers,
            1_u8,
            FutarchyError::InvalidTransaction
        );

        // Source + destination are writable non-signers
        require_eq!(
            message.num_writable_non_signers,
            2_u8,
            FutarchyError::InvalidTransaction
        );

        // No address table lookups
        require!(
            message.address_table_lookups.is_empty(),
            FutarchyError::InvalidTransaction
        );

        // Must have exactly 1 instruction
        require!(
            message.instructions.len() == 1,
            FutarchyError::InvalidTransaction
        );

        let instruction = &message.instructions[0];

        // Program ID must be SPL Token
        let program_id = message
            .account_keys
            .get(instruction.program_id_index as usize)
            .ok_or(error!(FutarchyError::InvalidTransaction))?;
        require_keys_eq!(
            *program_id,
            self.token_program.key(),
            FutarchyError::InvalidTransaction
        );

        // Instruction data must be a Transfer: discriminator [3] + amount as u64 LE (9 bytes total)
        require!(
            instruction.data.len() == 9,
            FutarchyError::InvalidTransaction
        );
        require!(instruction.data[0] == 3, FutarchyError::InvalidTransaction);
        let encoded_amount = u64::from_le_bytes(
            instruction.data[1..9]
                .try_into()
                .map_err(|_| error!(FutarchyError::InvalidTransaction))?,
        );
        require_eq!(
            encoded_amount,
            params.amount,
            FutarchyError::InvalidTransaction
        );

        // Validate the transfer accounts: source, destination, authority
        require!(
            instruction.account_indexes.len() >= 3,
            FutarchyError::InvalidTransaction
        );

        let source = message
            .account_keys
            .get(instruction.account_indexes[0] as usize)
            .ok_or(error!(FutarchyError::InvalidTransaction))?;
        require_keys_eq!(
            *source,
            self.dao_quote_vault_account.key(),
            FutarchyError::InvalidTransaction
        );

        let destination = message
            .account_keys
            .get(instruction.account_indexes[1] as usize)
            .ok_or(error!(FutarchyError::InvalidTransaction))?;
        require_keys_eq!(
            *destination,
            self.recipient_quote_account.key(),
            FutarchyError::InvalidTransaction
        );

        let authority = message
            .account_keys
            .get(instruction.account_indexes[2] as usize)
            .ok_or(error!(FutarchyError::InvalidTransaction))?;
        require_keys_eq!(
            *authority,
            self.squads_multisig_vault.key(),
            FutarchyError::InvalidTransaction
        );

        Ok(())
    }

    pub fn handle(
        ctx: Context<Self>,
        params: InitiateVaultSpendOptimisticProposalParams,
    ) -> Result<()> {
        let Self {
            squads_multisig,
            squads_multisig_vault,
            squads_spending_limit: _,
            squads_proposal,
            squads_vault_transaction: _,
            dao,
            event_authority: _,
            program: _,
            squads_program: _,
            proposer,
            recipient: _,
            recipient_quote_account,
            token_program: _,
            dao_quote_vault_account,
        } = ctx.accounts;

        // Update the DAO state
        let clock = Clock::get()?;

        dao.optimistic_proposal = Some(OptimisticProposal {
            squads_proposal: squads_proposal.key(),
            enqueued_timestamp: clock.unix_timestamp,
        });
        dao.seq_num += 1;

        emit_cpi!(InitiateVaultSpendOptimisticProposalEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            dao: dao.key(),
            proposer: proposer.key(),
            squads_proposal: squads_proposal.key(),
            squads_multisig: squads_multisig.key(),
            squads_multisig_vault: squads_multisig_vault.key(),
            amount: params.amount,
            recipient: ctx.accounts.recipient.key(),
            dao_quote_vault_account: dao_quote_vault_account.key(),
            recipient_quote_account: recipient_quote_account.key(),
            enqueued_timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}
