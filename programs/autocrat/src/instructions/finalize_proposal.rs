use conditional_vault::{cpi::accounts::ResolveQuestion, ResolveQuestionArgs};

use super::*;

#[derive(Accounts)]
#[event_cpi]
pub struct FinalizeProposal<'info> {
    #[account(mut,
        has_one = question,
        has_one = pass_amm,
        has_one = fail_amm,
        has_one = dao,
        has_one = squads_proposal,
    )]
    pub proposal: Account<'info, Proposal>,
    /// CHECK: checked by the has_one
    #[account(mut)]
    pub squads_proposal: UncheckedAccount<'info>,
    pub squads_multisig_program: Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
    /// CHECK: checked by the has_one
    pub squads_multisig: UncheckedAccount<'info>,
    pub pass_amm: Account<'info, Amm>,
    pub fail_amm: Account<'info, Amm>,
    #[account(mut, has_one = squads_multisig)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(mut)]
    pub question: Account<'info, Question>,
    #[account(
        mut,
        associated_token::mint = pass_amm.lp_mint,
        associated_token::authority = proposal.proposer,
    )]
    pub pass_lp_user_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = fail_amm.lp_mint,
        associated_token::authority = proposal.proposer,
    )]
    pub fail_lp_user_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = pass_amm.lp_mint,
        associated_token::authority = proposal,
    )]
    pub pass_lp_vault_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = fail_amm.lp_mint,
        associated_token::authority = proposal,
    )]
    pub fail_lp_vault_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub vault_program: Program<'info, ConditionalVaultProgram>,
    /// CHECK: checked by vault program
    pub vault_event_authority: UncheckedAccount<'info>,
}

impl FinalizeProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        require!(
            clock.slot >= self.proposal.slot_enqueued + self.proposal.duration_in_slots,
            AutocratError::ProposalTooYoung
        );

        require!(
            self.proposal.state == ProposalState::Pending,
            AutocratError::ProposalAlreadyFinalized
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let FinalizeProposal {
            proposal,
            squads_proposal,
            squads_multisig_program,
            squads_multisig,
            pass_amm,
            fail_amm,
            dao,
            question,
            pass_lp_user_account,
            fail_lp_user_account,
            pass_lp_vault_account,
            fail_lp_vault_account,
            vault_program,
            token_program,
            vault_event_authority,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let proposer_key = proposal.proposer;
        let nonce = proposal.nonce;
        let proposal_seeds = &[
            b"proposal",
            proposer_key.as_ref(),
            &nonce.to_le_bytes(),
            &[proposal.pda_bump],
        ];
        let proposal_signer = &[&proposal_seeds[..]];

        for (lp_tokens_to_unlock, from, to) in [
            (
                proposal.pass_lp_tokens_locked,
                pass_lp_vault_account,
                pass_lp_user_account,
            ),
            (
                proposal.fail_lp_tokens_locked,
                fail_lp_vault_account,
                fail_lp_user_account,
            ),
        ] {
            // without this, someone can brick a proposal if they have another proposal transfer
            // out its LP tokens from the treasury.
            let lp_tokens_to_unlock = std::cmp::min(lp_tokens_to_unlock, from.amount);

            token::transfer(
                CpiContext::new(
                    token_program.to_account_info(),
                    Transfer {
                        from: from.to_account_info(),
                        to: to.to_account_info(),
                        authority: proposal.to_account_info(),
                    },
                )
                .with_signer(proposal_signer),
                lp_tokens_to_unlock,
            )?;
        }

        let calculate_twap = |amm: &Amm| -> Result<u128> {
            let slots_passed = amm.oracle.last_updated_slot - proposal.slot_enqueued;

            require!(
                slots_passed >= proposal.duration_in_slots,
                AutocratError::MarketsTooYoung
            );

            amm.get_twap()
        };

        let pass_market_twap = calculate_twap(pass_amm)?;
        let fail_market_twap = calculate_twap(fail_amm)?;

        // this can't overflow because each twap can only be MAX_PRICE (~1e31),
        // MAX_BPS + pass_threshold_bps is at most 1e5, and a u128 can hold
        // 1e38. still, saturate
        let threshold = fail_market_twap
            .saturating_mul(MAX_BPS.saturating_add(dao.pass_threshold_bps).into())
            / MAX_BPS as u128;

        let (new_proposal_state, payout_numerators) = if pass_market_twap > threshold {
            (ProposalState::Passed, vec![0, 1])
        } else {
            (ProposalState::Failed, vec![1, 0])
        };

        proposal.state = new_proposal_state;

        let vault_program = vault_program.to_account_info();
        let cpi_accounts = ResolveQuestion {
            question: question.to_account_info(),
            oracle: proposal.to_account_info(),
            event_authority: vault_event_authority.to_account_info(),
            program: vault_program.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(vault_program, cpi_accounts).with_signer(proposal_signer);
        conditional_vault::cpi::resolve_question(
            cpi_ctx,
            ResolveQuestionArgs { payout_numerators },
        )?;

        let dao_nonce = &dao.nonce.to_le_bytes();
        let dao_seeds = &[b"dao".as_ref(), dao_nonce, &[dao.pda_bump]];
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
        }

        let clock = Clock::get()?;

        emit_cpi!(FinalizeProposalEvent {
            common: CommonFields::new(&clock),
            proposal: proposal.key(),
            dao: dao.key(),
            pass_market_twap,
            fail_market_twap,
            threshold,
            state: new_proposal_state,
        });

        Ok(())
    }
}
