use anchor_lang::solana_program::instruction::Instruction;

use super::*;

/// The accounts shared by the typed initialize instructions
/// (`initialize_*_proposal`), embedded as a composite field. Per-type extra
/// accounts live on the embedding struct.
#[derive(Accounts)]
pub struct TypedInitializeAccounts<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [SEED_PROPOSAL, squads_proposal.key().as_ref()],
        bump
    )]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(mut, has_one = squads_multisig)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(mut)]
    pub squads_multisig: Box<Account<'info, squads_multisig_program::Multisig>>,
    /// CHECK: empty on entry; the vault_transaction_create CPI initializes it
    /// and enforces that it is the transaction PDA for the next transaction index
    #[account(mut)]
    pub squads_transaction: UncheckedAccount<'info>,
    /// CHECK: empty on entry; the proposal_create CPI initializes it and
    /// enforces that it is the proposal PDA for the next transaction index
    #[account(mut)]
    pub squads_proposal: UncheckedAccount<'info>,
    #[account(
        constraint = question.oracle == proposal.key()
    )]
    pub question: Box<Account<'info, Question>>,
    #[account(
        constraint = base_vault.underlying_token_mint == dao.base_mint,
        has_one = question,
    )]
    pub base_vault: Box<Account<'info, ConditionalVault>>,
    #[account(
        constraint = quote_vault.underlying_token_mint == dao.quote_mint,
        has_one = question,
    )]
    pub quote_vault: Box<Account<'info, ConditionalVault>>,
    pub proposer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// The Squads-side creator of the vault transaction and proposal, an
    /// Initiate | Execute member of every DAO multisig. Its keypair ships in
    /// the SDK, so anyone can provide this signature.
    #[account(address = permissionless_account::id())]
    pub permissionless_account: Signer<'info>,
    pub squads_program: Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
    pub system_program: Program<'info, System>,
}

impl TypedInitializeAccounts<'_> {
    /// The DAO and market-plumbing checks shared by every typed initialize.
    /// Per-type rules live on each embedding instruction's own `validate`.
    pub fn validate(&self) -> Result<()> {
        require!(self.dao.liquidator.is_none(), FutarchyError::DaoLiquidated);

        require_eq!(
            self.question.num_outcomes(),
            2,
            FutarchyError::QuestionMustBeBinary
        );

        // Should never be the case because the oracle is the proposal account, and you can't re-initialize a proposal
        assert!(!self.question.is_resolved());

        Ok(())
    }

    /// Wraps `instructions` in a Squads vault transaction, creates its Squads
    /// proposal (`draft: false`), and initializes the futarchy proposal with
    /// `action` and its per-kind snapshots. Returns the event so the embedding
    /// instruction can `emit_cpi!` it.
    pub fn initialize_proposal(
        &mut self,
        instructions: &[Instruction],
        action: ProposalAction,
        proposal_bump: u8,
    ) -> Result<InitializeProposalEvent> {
        let transaction_message =
            compile_squads_transaction_message(&self.dao.squads_multisig_vault, instructions)?;
        let transaction_message_bytes = transaction_message.try_to_vec()?;

        squads_multisig_program::cpi::vault_transaction_create(
            CpiContext::new(
                self.squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::VaultTransactionCreate {
                    creator: self.permissionless_account.to_account_info(),
                    multisig: self.squads_multisig.to_account_info(),
                    rent_payer: self.payer.to_account_info(),
                    system_program: self.system_program.to_account_info(),
                    transaction: self.squads_transaction.to_account_info(),
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
        self.squads_multisig.reload()?;
        let transaction_index = self.squads_multisig.transaction_index;

        squads_multisig_program::cpi::proposal_create(
            CpiContext::new(
                self.squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::ProposalCreate {
                    creator: self.permissionless_account.to_account_info(),
                    multisig: self.squads_multisig.to_account_info(),
                    rent_payer: self.payer.to_account_info(),
                    system_program: self.system_program.to_account_info(),
                    proposal: self.squads_proposal.to_account_info(),
                },
            ),
            squads_multisig_program::ProposalCreateArgs {
                transaction_index,
                draft: false,
            },
        )?;

        let clock = Clock::get()?;
        let params = action.params();

        self.dao.proposal_count += 1;

        let proposal = Proposal {
            number: self.dao.proposal_count,
            squads_proposal: self.squads_proposal.key(),
            proposer: self.proposer.key(),
            timestamp_enqueued: 0,
            state: ProposalState::Draft { amount_staked: 0 },
            base_vault: self.base_vault.key(),
            quote_vault: self.quote_vault.key(),
            dao: self.dao.key(),
            pda_bump: proposal_bump,
            question: self.question.key(),
            duration_in_seconds: params.duration_seconds,
            pass_base_mint: self.base_vault.conditional_token_mints[1],
            fail_base_mint: self.base_vault.conditional_token_mints[0],
            pass_quote_mint: self.quote_vault.conditional_token_mints[1],
            fail_quote_mint: self.quote_vault.conditional_token_mints[0],
            is_team_sponsored: false,
            pass_threshold_bps: params.pass_threshold_bps,
            council_can_block: params.council_can_block,
            action,
        };
        self.proposal.set_inner(proposal);

        self.dao.seq_num += 1;

        Ok(InitializeProposalEvent {
            common: CommonFields::new(&clock, self.dao.seq_num),
            proposal: self.proposal.key(),
            dao: self.dao.key(),
            question: self.question.key(),
            base_vault: self.base_vault.key(),
            quote_vault: self.quote_vault.key(),
            proposer: self.proposer.key(),
            number: self.dao.proposal_count,
            pda_bump: proposal_bump,
            duration_in_seconds: self.proposal.duration_in_seconds,
            squads_proposal: self.squads_proposal.key(),
            squads_multisig: self.dao.squads_multisig,
            squads_multisig_vault: self.dao.squads_multisig_vault,
            action: self.proposal.action.clone(),
        })
    }
}
