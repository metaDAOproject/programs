use super::*;

use conditional_vault::{cpi::accounts::ResolveQuestion, ResolveQuestionArgs};
use squads_multisig_program::program::SquadsMultisigProgram;

pub mod admin {
    use anchor_lang::prelude::declare_id;
    declare_id!("CWGawadYU8CzRVBecnJymNw97H7E3ndDinV5sMzesgY2");
}

#[derive(Accounts)]
#[event_cpi]
pub struct AdminCancelProposal<'info> {
    #[account(
        mut, has_one = question, has_one = dao, has_one = squads_proposal,
        has_one = base_vault, has_one = quote_vault,
        has_one = pass_base_mint, has_one = pass_quote_mint,
        has_one = fail_base_mint, has_one = fail_quote_mint
    )]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(mut, has_one = squads_multisig)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(mut)]
    pub question: Box<Account<'info, Question>>,
    /// CHECK: checked by squads multisig program
    #[account(mut)]
    pub squads_proposal: UncheckedAccount<'info>,
    /// CHECK: checked by squads multisig program
    pub squads_multisig: UncheckedAccount<'info>,
    pub squads_multisig_program: Program<'info, SquadsMultisigProgram>,

    #[account(mut, associated_token::mint = proposal.pass_base_mint, associated_token::authority = dao)]
    pub amm_pass_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = proposal.pass_quote_mint, associated_token::authority = dao)]
    pub amm_pass_quote_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = proposal.fail_base_mint, associated_token::authority = dao)]
    pub amm_fail_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = proposal.fail_quote_mint, associated_token::authority = dao)]
    pub amm_fail_quote_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = dao.base_mint, associated_token::authority = dao)]
    pub amm_base_vault: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = dao.quote_mint, associated_token::authority = dao)]
    pub amm_quote_vault: Account<'info, TokenAccount>,

    pub vault_program: Program<'info, ConditionalVaultProgram>,
    /// CHECK: checked by vault program
    pub vault_event_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    #[account(mut)]
    pub quote_vault: Box<Account<'info, ConditionalVault>>,
    #[account(mut, address = quote_vault.underlying_token_account)]
    pub quote_vault_underlying_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub pass_quote_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub fail_quote_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub pass_base_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub fail_base_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub base_vault: Box<Account<'info, ConditionalVault>>,
    #[account(mut, address = base_vault.underlying_token_account)]
    pub base_vault_underlying_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub admin: Signer<'info>,
}

impl AdminCancelProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(self.admin.key(), admin::ID, FutarchyError::InvalidAdmin);

        require!(
            self.proposal.state == ProposalState::Pending,
            FutarchyError::ProposalNotActive
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let Self {
            proposal,
            dao,
            question,
            squads_proposal,
            squads_multisig,
            squads_multisig_program,
            vault_program,
            quote_vault,
            token_program,
            event_authority: _,
            vault_event_authority,
            program: _,
            quote_vault_underlying_token_account,
            pass_quote_mint,
            fail_quote_mint,
            amm_pass_quote_vault,
            amm_fail_quote_vault,
            pass_base_mint,
            fail_base_mint,
            amm_quote_vault,
            amm_pass_base_vault,
            amm_fail_base_vault,
            amm_base_vault,
            base_vault,
            base_vault_underlying_token_account,
            admin: _,
        } = ctx.accounts;

        let squads_proposal_key = squads_proposal.key();
        let proposal_seeds = &[
            b"proposal",
            squads_proposal_key.as_ref(),
            &[proposal.pda_bump],
        ];
        let proposal_signer = &[&proposal_seeds[..]];

        let PoolState::Futarchy { fail, mut spot, .. } = dao.amm.state.to_owned() else {
            unreachable!();
        };

        proposal.state = ProposalState::Failed;

        let cpi_accounts = ResolveQuestion {
            question: question.to_account_info(),
            oracle: proposal.to_account_info(),
            event_authority: vault_event_authority.to_account_info(),
            program: vault_program.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(vault_program.to_account_info(), cpi_accounts)
            .with_signer(proposal_signer);
        conditional_vault::cpi::resolve_question(
            cpi_ctx,
            ResolveQuestionArgs {
                payout_numerators: vec![1, 0],
            },
        )?;

        let dao_nonce = &dao.nonce.to_le_bytes();
        let dao_creator_key = &dao.dao_creator.as_ref();
        let dao_seeds = &[b"dao".as_ref(), dao_creator_key, dao_nonce, &[dao.pda_bump]];
        let dao_signer = &[&dao_seeds[..]];

        squads_multisig_program::cpi::proposal_reject(
            CpiContext::new_with_signer(
                squads_multisig_program.to_account_info(),
                squads_multisig_program::cpi::accounts::ProposalVote {
                    proposal: squads_proposal.to_account_info(),
                    multisig: squads_multisig.to_account_info(),
                    member: dao.to_account_info(),
                },
                dao_signer,
            ),
            squads_multisig_program::ProposalVoteArgs { memo: None },
        )?;

        spot.base_reserves += fail.base_reserves;
        spot.quote_reserves += fail.quote_reserves;
        spot.base_protocol_fee_balance += fail.base_protocol_fee_balance;
        spot.quote_protocol_fee_balance += fail.quote_protocol_fee_balance;

        let quote_cpi_context = CpiContext::new_with_signer(
            vault_program.to_account_info(),
            conditional_vault::cpi::accounts::InteractWithVault {
                question: question.to_account_info(),
                vault: quote_vault.to_account_info(),
                vault_underlying_token_account: quote_vault_underlying_token_account
                    .to_account_info(),
                authority: dao.to_account_info(),
                user_underlying_token_account: amm_quote_vault.to_account_info(),
                event_authority: vault_event_authority.to_account_info(),
                program: vault_program.to_account_info(),
                token_program: token_program.to_account_info(),
            },
            dao_signer,
        )
        .with_remaining_accounts(vec![
            fail_quote_mint.to_account_info(),
            pass_quote_mint.to_account_info(),
            amm_fail_quote_vault.to_account_info(),
            amm_pass_quote_vault.to_account_info(),
        ]);

        conditional_vault::cpi::redeem_tokens(quote_cpi_context)?;

        let base_cpi_context = CpiContext::new_with_signer(
            vault_program.to_account_info(),
            conditional_vault::cpi::accounts::InteractWithVault {
                question: question.to_account_info(),
                vault: base_vault.to_account_info(),
                vault_underlying_token_account: base_vault_underlying_token_account
                    .to_account_info(),
                authority: dao.to_account_info(),
                user_underlying_token_account: amm_base_vault.to_account_info(),
                event_authority: vault_event_authority.to_account_info(),
                program: vault_program.to_account_info(),
                token_program: token_program.to_account_info(),
            },
            dao_signer,
        )
        .with_remaining_accounts(vec![
            fail_base_mint.to_account_info(),
            pass_base_mint.to_account_info(),
            amm_fail_base_vault.to_account_info(),
            amm_pass_base_vault.to_account_info(),
        ]);

        conditional_vault::cpi::redeem_tokens(base_cpi_context)?;

        dao.amm.state = PoolState::Spot { spot };

        dao.seq_num += 1;

        let clock = Clock::get()?;

        emit_cpi!(AdminCancelProposalEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            proposal: proposal.key(),
            dao: dao.key(),
            admin: ctx.accounts.admin.key(),
            post_amm_state: dao.amm.clone(),
        });

        Ok(())
    }
}
