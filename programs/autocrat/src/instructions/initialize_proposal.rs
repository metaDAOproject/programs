use super::*;

use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use conditional_vault::program::ConditionalVault as ConditionalVaultProgram;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InitializeProposalParams {
}

#[derive(Accounts)]
#[instruction(args: InitializeProposalParams)]
#[event_cpi]
pub struct InitializeProposal<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + FutarchyProposal::INIT_SPACE,
        seeds = [b"proposal", squads_proposal.key().as_ref()],
        bump
    )]
    pub proposal: Box<Account<'info, FutarchyProposal>>,
    pub squads_proposal: Box<Account<'info, squads_multisig_program::accounts::Proposal>>,
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
    // TODO: this should also check the other way around: that the dao has canonicalized this amm
    #[account(mut, has_one = dao)]
    pub futarchy_amm: Box<Account<'info, Amm>>,
    #[account(
        constraint = question.oracle == proposal.key()
    )]
    pub question: Box<Account<'info, Question>>,
    pub amm_token_accounts: AmmTokenAccounts<'info>,
    #[account(
        seeds = [conditional_vault::CONDITIONAL_VAULT_SEED, question.key().as_ref(), dao.quote_mint.key().as_ref()],
        seeds::program = conditional_vault_program,
        bump,
        mut,
    )]
    pub quote_vault: Box<Account<'info, ConditionalVaultAccount>>,
    #[account(
        seeds = [conditional_vault::CONDITIONAL_VAULT_SEED, question.key().as_ref(), dao.base_mint.key().as_ref()],
        seeds::program = conditional_vault_program,
        bump,
        mut,
    )]
    pub base_vault: Box<Account<'info, ConditionalVaultAccount>>,
    #[account(mut)]
    pub base_vault_underlying_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub quote_vault_underlying_token_account: Box<Account<'info, TokenAccount>>,
    pub base_mint: Box<Account<'info, Mint>>,
    pub quote_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub fail_base_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub fail_quote_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub pass_base_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub pass_quote_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
    pub proposer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub conditional_vault_program: Program<'info, ConditionalVaultProgram>,
    /// CHECK: verified by conditional_vault
    pub vault_event_authority: UncheckedAccount<'info>,
}

impl InitializeProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        require_eq!(
            self.question.num_outcomes(),
            2,
            AutocratError::QuestionMustBeBinary
        );

        require_keys_eq!(self.squads_proposal.multisig, self.dao.squads_multisig);

        match self.squads_proposal.status {
            squads_multisig_program::types::ProposalStatus::Active { timestamp: _ } => {}
            _ => {
                msg!("squads proposal status: {:?}", self.squads_proposal.status);
                return Err(AutocratError::InvalidSquadsProposalStatus.into());
            }
        }

        assert!(self.futarchy_amm.state == AmmState::Spot);

        // TODO: some checks that the futarchy amm

        // Should never be the case because the oracle is the proposal account, and you can't re-initialize a proposal
        assert!(!self.question.is_resolved());

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: InitializeProposalParams) -> Result<()> {
        let Self {
            base_vault,
            quote_vault,
            question,
            proposal,
            squads_proposal,
            dao,
            proposer,
            futarchy_amm,
            payer: _,
            system_program: _,
            event_authority: _,
            program: _,
            amm_token_accounts,
            base_vault_underlying_token_account,
            quote_vault_underlying_token_account,
            base_mint,
            quote_mint,
            fail_base_mint,
            fail_quote_mint,
            pass_base_mint,
            pass_quote_mint,
            token_program,
            conditional_vault_program,
            vault_event_authority,
        } = ctx.accounts;


        let clock = Clock::get()?;

        dao.proposal_count += 1;

        proposal.set_inner(FutarchyProposal {
            number: dao.proposal_count,
            squads_proposal: squads_proposal.key(),
            proposer: proposer.key(),
            slot_enqueued: clock.slot,
            state: ProposalState::Pending,
            base_vault: base_vault.key(),
            quote_vault: quote_vault.key(),
            futarchy_amm: futarchy_amm.key(),
            dao: dao.key(),
            pda_bump: ctx.bumps.proposal,
            question: question.key(),
            duration_in_slots: dao.slots_per_proposal,
        });

        // Take half the base and quote reserves from the spot pool and provide it
        // to the pass and fail pools. We don't need to actually do any splits
        // because most of the conditional token reserves are virtual.

        let base_to_provide = ctx.accounts.amm_token_accounts.unconditional_base.amount / 2;
        let quote_to_provide = ctx.accounts.amm_token_accounts.unconditional_quote.amount / 2;

        // futarchy_amm.spot_pool.base_reserves -= base_to_provide;
        // futarchy_amm.spot_pool.quote_reserves -= quote_to_provide;

        futarchy_amm.state = AmmState::Futarchy {
            proposal: proposal.key(),
            question: question.key(),
            // pass_pool: Pool {
            //     base_reserves: base_to_provide,
            //     quote_reserves: quote_to_provide,
            // },
            // fail_pool: Pool {
            //     base_reserves: base_to_provide,
            //     quote_reserves: quote_to_provide,
            // },
        };

        let signer_seeds = &[b"futarchy_amm".as_ref(), &[ctx.accounts.futarchy_amm.bump]];
        let signer = &[&signer_seeds[..]];

        let base_cpi_context = CpiContext::new_with_signer(
            ctx.accounts.conditional_vault_program.to_account_info(),
            conditional_vault::cpi::accounts::InteractWithVault {
                question: ctx.accounts.question.to_account_info(),
                vault: ctx.accounts.base_vault.to_account_info(),
                vault_underlying_token_account: ctx
                    .accounts
                    .base_vault_underlying_token_account
                    .to_account_info(),
                authority: ctx.accounts.futarchy_amm.to_account_info(),
                user_underlying_token_account: ctx
                    .accounts
                    .amm_token_accounts
                    .unconditional_base
                    .to_account_info(),
                event_authority: ctx.accounts.vault_event_authority.to_account_info(),
                program: ctx.accounts.conditional_vault_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            signer,
        )
        .with_remaining_accounts(vec![
            ctx.accounts.fail_base_mint.to_account_info(),
            ctx.accounts.pass_base_mint.to_account_info(),
            ctx.accounts.amm_token_accounts.fail_base.to_account_info(),
            ctx.accounts.amm_token_accounts.pass_base.to_account_info(),
        ]);

        conditional_vault::cpi::split_tokens(base_cpi_context, base_to_provide)?;

        let quote_cpi_context = CpiContext::new_with_signer(
            ctx.accounts.conditional_vault_program.to_account_info(),
            conditional_vault::cpi::accounts::InteractWithVault {
                question: ctx.accounts.question.to_account_info(),
                vault: ctx.accounts.quote_vault.to_account_info(),
                vault_underlying_token_account: ctx
                    .accounts
                    .quote_vault_underlying_token_account
                    .to_account_info(),
                authority: ctx.accounts.futarchy_amm.to_account_info(),
                user_underlying_token_account: ctx
                    .accounts
                    .amm_token_accounts
                    .unconditional_quote
                    .to_account_info(),
                event_authority: ctx.accounts.vault_event_authority.to_account_info(),
                program: ctx.accounts.conditional_vault_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            signer,
        )
        .with_remaining_accounts(vec![
            ctx.accounts.fail_quote_mint.to_account_info(),
            ctx.accounts.pass_quote_mint.to_account_info(),
            ctx.accounts.amm_token_accounts.fail_quote.to_account_info(),
            ctx.accounts.amm_token_accounts.pass_quote.to_account_info(),
        ]);

        conditional_vault::cpi::split_tokens(quote_cpi_context, quote_to_provide)?;

        // emit_cpi!(InitializeProposalEvent {
        //     common: CommonFields::new(&clock),
        //     proposal: proposal.key(),
        //     dao: dao.key(),
        //     question: question.key(),
        //     pass_amm: pass_amm.key(),
        //     fail_amm: fail_amm.key(),
        //     base_vault: base_vault.key(),
        //     quote_vault: quote_vault.key(),
        //     pass_lp_mint: pass_lp_mint.key(),
        //     fail_lp_mint: fail_lp_mint.key(),
        //     proposer: proposer.key(),
        //     nonce,
        //     number: dao.proposal_count,
        //     pass_lp_tokens_locked: pass_lp_tokens_to_lock,
        //     fail_lp_tokens_locked: fail_lp_tokens_to_lock,
        //     pda_bump: ctx.bumps.proposal,
        //     duration_in_slots: proposal.duration_in_slots,
        // });

        Ok(())
    }
}
