use super::*;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct InitiateVaultSpendOptimisticProposalParams {
    pub amount: u64,
}

#[derive(Accounts)]
#[event_cpi]
pub struct InitiateVaultSpendOptimisticProposal<'info> {
    #[account(mut, seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_MULTISIG, dao.key().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig: Account<'info, squads_multisig_program::Multisig>,
    /// CHECK: The squads multisig vault that executes the transaction
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_VAULT, 0_u8.to_le_bytes().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig_vault: UncheckedAccount<'info>,
    #[account(mut, seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_SPENDING_LIMIT, dao.key().as_ref()], bump, seeds::program = squads_program)]
    pub squads_spending_limit: Account<'info, squads_multisig_program::SpendingLimit>,
    // Probably need to use unchecked account, as these are not yet initialized
    #[account(mut)]
    pub squads_proposal: Box<Account<'info, squads_multisig_program::Proposal>>,
    #[account(mut)]
    pub squads_vault_transaction: Box<Account<'info, squads_multisig_program::VaultTransaction>>,

    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(mut, address = dao.team_address)]
    pub proposer: Signer<'info>,

    #[account(address = permissionless_account::id())]
    pub squads_multisig_permissionless_account: Signer<'info>,

    /// CHECK: Used for constraints
    pub recipient: UncheckedAccount<'info>,
    #[account(mut, associated_token::mint = dao.quote_mint, associated_token::authority = recipient)]
    pub recipient_quote_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = dao.quote_mint, associated_token::authority = dao.squads_multisig_vault)]
    pub dao_quote_vault_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub squads_program: Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
    pub token_program: Program<'info, Token>,
}

impl InitiateVaultSpendOptimisticProposal<'_> {
    pub fn validate(&self, params: &InitiateVaultSpendOptimisticProposalParams) -> Result<()> {
        require_keys_eq!(self.squads_proposal.multisig, self.dao.squads_multisig);

        // Optimistic governance must be enabled
        require!(
            self.dao.is_optimistic_governance_enabled,
            FutarchyError::OptimisticGovernanceDisabled
        );

        // Pool must be in spot state - no active proposals
        match self.dao.amm.state {
            PoolState::Spot { spot: _ } => {}
            _ => {
                return Err(FutarchyError::PoolNotInSpotState.into());
            }
        }

        // There should be no active optimistic proposal
        require!(
            self.dao.optimistic_proposal.is_none(),
            FutarchyError::ActiveOptimisticProposalAlreadyEnqueued
        );

        // A minimum of proposal duration must have passed since the last optimistic proposal was enqueued
        match self.dao.optimistic_proposal {
            Some(ref optimistic_proposal) => {
                require_gte!(
                    Clock::get()?.unix_timestamp,
                    optimistic_proposal.enqueued_timestamp + self.dao.seconds_per_proposal as i64,
                    FutarchyError::ProposalDurationTooShort
                );
            }
            None => {}
        };

        // Amount must be less than or equal to 3 times the spending limit
        require_gte!(
            self.squads_spending_limit.amount.checked_mul(3).unwrap(),
            params.amount,
            FutarchyError::InvalidAmount
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
            squads_vault_transaction,
            dao,
            payer: _,
            system_program,
            event_authority: _,
            program: _,
            squads_program,
            proposer,
            recipient: _,
            recipient_quote_account,
            squads_multisig_permissionless_account,
            token_program,
            dao_quote_vault_account,
        } = ctx.accounts;

        // Prepare the transfer instruction
        let ix = anchor_spl::token::spl_token::instruction::transfer(
            &token_program.key(),
            &dao_quote_vault_account.key(),
            &recipient_quote_account.key(),
            &squads_multisig_vault.key(),
            &[&squads_multisig_vault.key()],
            params.amount,
        )?;

        // Compile the transaction message in Squads' format
        let transaction_message =
            compile_squads_transaction_message(&squads_multisig_vault.key(), &[ix])?;

        let transaction_message_bytes = transaction_message.try_to_vec()?;

        let dao_nonce = &dao.nonce.to_le_bytes();
        let dao_creator_key = dao.dao_creator.as_ref();
        let dao_seeds = &[b"dao".as_ref(), dao_creator_key, dao_nonce, &[dao.pda_bump]];

        let dao_signer = &[&dao_seeds[..]];

        // Create the squads transaction
        squads_multisig_program::cpi::vault_transaction_create(
            CpiContext::new(
                squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::VaultTransactionCreate {
                    creator: squads_multisig_permissionless_account.to_account_info(),
                    multisig: squads_multisig.to_account_info(),
                    rent_payer: proposer.to_account_info(),
                    system_program: system_program.to_account_info(),
                    transaction: squads_vault_transaction.to_account_info(),
                },
            ),
            squads_multisig_program::VaultTransactionCreateArgs {
                ephemeral_signers: 0,
                vault_index: 0,
                transaction_message: transaction_message_bytes,
                memo: None,
            },
        )?;

        // Reload the squads multisig account to get the latest transaction index
        squads_multisig.reload()?;
        let transaction_index = squads_multisig.transaction_index;

        // Create the squads proposal
        squads_multisig_program::cpi::proposal_create(
            CpiContext::new_with_signer(
                squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::ProposalCreate {
                    creator: squads_multisig_permissionless_account.to_account_info(),
                    multisig: squads_multisig.to_account_info(),
                    rent_payer: proposer.to_account_info(),
                    system_program: system_program.to_account_info(),
                    proposal: squads_proposal.to_account_info(),
                },
                dao_signer,
            ),
            squads_multisig_program::ProposalCreateArgs {
                transaction_index,
                draft: false,
            },
        )?;

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
