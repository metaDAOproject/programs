use super::*;

use conditional_vault::{cpi::accounts::ResolveQuestion, ResolveQuestionArgs};
use squads_multisig_program::program::SquadsMultisigProgram;

#[derive(Accounts)]
#[event_cpi]
pub struct FinalizeProposal<'info> {
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
}

impl FinalizeProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        require_gte!(
            clock.unix_timestamp,
            self.proposal.timestamp_enqueued + self.proposal.duration_in_seconds as i64,
            FutarchyError::ProposalTooYoung
        );

        require!(
            self.proposal.state == ProposalState::Pending,
            FutarchyError::ProposalAlreadyFinalized
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
        } = ctx.accounts;

        let squads_proposal_key = squads_proposal.key();
        let proposal_seeds = &[
            SEED_PROPOSAL,
            squads_proposal_key.as_ref(),
            &[proposal.pda_bump],
        ];
        let proposal_signer = &[&proposal_seeds[..]];

        let calculate_twap = |amm: &Pool| -> Result<u128> {
            let seconds_passed = amm.oracle.last_updated_timestamp - proposal.timestamp_enqueued;

            require_gte!(
                seconds_passed,
                proposal.duration_in_seconds as i64,
                FutarchyError::MarketsTooYoung
            );

            amm.get_twap()
        };

        let PoolState::Futarchy {
            pass,
            fail,
            mut spot,
        } = dao.amm.state.to_owned()
        else {
            unreachable!();
        };

        let pass_market_twap = calculate_twap(&pass)?;
        let fail_market_twap = calculate_twap(&fail)?;

        let threshold_bps = if proposal.is_team_sponsored {
            dao.team_sponsored_pass_threshold_bps
        } else {
            // Thanks to invariants this will never error - still it's better to be safe here.
            i16::try_from(dao.pass_threshold_bps).map_err(|_| FutarchyError::CastingOverflow)?
        };

        // this can't overflow because each twap can only be MAX_PRICE (~1e31),
        // MAX_BPS + pass_threshold_bps is at most 1e5, and a u128 can hold
        // 1e38

        let threshold = fail_market_twap * u128::try_from(MAX_BPS as i16 + threshold_bps).unwrap()
            / MAX_BPS as u128;

        let (new_proposal_state, payout_numerators) = if pass_market_twap > threshold {
            (ProposalState::Passed, vec![0, 1])
        } else {
            (ProposalState::Failed, vec![1, 0])
        };

        proposal.state = new_proposal_state;

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
            ResolveQuestionArgs { payout_numerators },
        )?;

        let dao_nonce = &dao.nonce.to_le_bytes();
        let dao_creator_key = &dao.dao_creator.as_ref();
        let dao_seeds = &[SEED_DAO, dao_creator_key, dao_nonce, &[dao.pda_bump]];
        let dao_signer = &[&dao_seeds[..]];

        if new_proposal_state == ProposalState::Passed {
            squads_multisig_program::cpi::proposal_approve(
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

            spot.base_reserves += pass.base_reserves;
            spot.quote_reserves += pass.quote_reserves;
            spot.base_protocol_fee_balance += pass.base_protocol_fee_balance;
            spot.quote_protocol_fee_balance += pass.quote_protocol_fee_balance;
        } else {
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
        }

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

        emit_cpi!(FinalizeProposalEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            proposal: proposal.key(),
            dao: dao.key(),
            pass_market_twap,
            fail_market_twap,
            threshold,
            state: new_proposal_state,
            squads_proposal: squads_proposal.key(),
            squads_multisig: dao.squads_multisig,
            post_amm_state: dao.amm.clone(),
            is_team_sponsored: proposal.is_team_sponsored,
        });

        Ok(())
    }
}
