use super::*;

use amm::state::ONE_MINUTE_IN_SLOTS;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use conditional_vault::program::ConditionalVault as ConditionalVaultProgram;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InitializeProposalParams {
<<<<<<< HEAD
    pub description_url: String,
    pub pass_lp_tokens_to_lock: u64,
    pub fail_lp_tokens_to_lock: u64,
=======
    pub nonce: u64,
>>>>>>> af0016f (Get basic swap + conditional swap accounting working)
}

#[derive(Accounts)]
#[instruction(args: InitializeProposalParams)]
#[event_cpi]
pub struct InitializeProposal<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [b"proposal", squads_proposal.key().as_ref()],
        bump
    )]
    pub proposal: Box<Account<'info, Proposal>>,
    pub squads_proposal: Box<Account<'info, squads_multisig_program::Proposal>>,
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
    // TODO: this should also check the other way around: that the dao has canonicalized this amm
    #[account(mut, has_one = dao)]
    pub futarchy_amm: Box<Account<'info, FutarchyAmm>>,
    #[account(
        constraint = question.oracle == proposal.key()
    )]
    pub question: Box<Account<'info, Question>>,
    #[account(
        constraint = quote_vault.underlying_token_mint == dao.quote_mint,
        has_one = question,
    )]
    pub quote_vault: Account<'info, ConditionalVaultAccount>,
    #[account(
        constraint = base_vault.underlying_token_mint == dao.base_mint,
        has_one = question,
    )]
    pub base_vault: Account<'info, ConditionalVaultAccount>,
<<<<<<< HEAD
    #[account(
        constraint = pass_amm.base_mint == base_vault.conditional_token_mints[PASS_INDEX],
        constraint = pass_amm.quote_mint == quote_vault.conditional_token_mints[PASS_INDEX],
    )]
    pub pass_amm: Box<Account<'info, Amm>>,
    #[account(constraint = pass_amm.lp_mint == pass_lp_mint.key())]
    pub pass_lp_mint: Box<Account<'info, Mint>>,
    #[account(constraint = fail_amm.lp_mint == fail_lp_mint.key())]
    pub fail_lp_mint: Box<Account<'info, Mint>>,
    #[account(
        constraint = fail_amm.base_mint == base_vault.conditional_token_mints[FAIL_INDEX],
        constraint = fail_amm.quote_mint == quote_vault.conditional_token_mints[FAIL_INDEX],
    )]
    pub fail_amm: Box<Account<'info, Amm>>,
    #[account(
        mut,
        associated_token::mint = pass_amm.lp_mint,
        associated_token::authority = proposer,
    )]
    pub pass_lp_user_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = fail_amm.lp_mint,
        associated_token::authority = proposer,
    )]
    pub fail_lp_user_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = pass_lp_mint,
        associated_token::authority = proposal,
    )]
    pub pass_lp_vault_account: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = fail_lp_mint,
        associated_token::authority = proposal,
    )]
    pub fail_lp_vault_account: Box<Account<'info, TokenAccount>>,
=======
>>>>>>> af0016f (Get basic swap + conditional swap accounting working)
    pub proposer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl InitializeProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        require_eq!(
            self.question.num_outcomes(),
            2,
            AutocratError::QuestionMustBeBinary
        );

<<<<<<< HEAD
        require_keys_eq!(self.squads_proposal.multisig, self.dao.squads_multisig);

        match self.squads_proposal.status {
            squads_multisig_program::ProposalStatus::Active { timestamp: _ } => {}
            _ => {
                msg!("squads proposal status: {:?}", self.squads_proposal.status);
                return Err(AutocratError::InvalidSquadsProposalStatus.into());
            }
        }

        for amm in [&self.pass_amm, &self.fail_amm] {
            // an attacker is able to crank 5 observations before a proposal starts
            require!(
                clock.slot < amm.created_at_slot + (5 * ONE_MINUTE_IN_SLOTS),
                AutocratError::AmmTooOld
            );
=======
        assert!(self.futarchy_amm.live_proposal.is_none());
>>>>>>> af0016f (Get basic swap + conditional swap accounting working)

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
        } = ctx.accounts;

<<<<<<< HEAD
        let InitializeProposalParams {
            description_url,
            pass_lp_tokens_to_lock,
            fail_lp_tokens_to_lock,
        } = params;

        require_gte!(
            pass_lp_user_account.amount,
            pass_lp_tokens_to_lock,
            AutocratError::InsufficientLpTokenBalance
        );
        require_gte!(
            fail_lp_user_account.amount,
            fail_lp_tokens_to_lock,
            AutocratError::InsufficientLpTokenBalance
        );

        let (pass_base_liquidity, pass_quote_liquidity) =
            pass_amm.get_base_and_quote_withdrawable(pass_lp_tokens_to_lock, pass_lp_mint.supply);
        let (fail_base_liquidity, fail_quote_liquidity) =
            fail_amm.get_base_and_quote_withdrawable(fail_lp_tokens_to_lock, fail_lp_mint.supply);

        for base_liquidity in [pass_base_liquidity, fail_base_liquidity] {
            require_gte!(
                base_liquidity,
                dao.min_base_futarchic_liquidity,
                AutocratError::InsufficientLpTokenLock
            );
        }

        for quote_liquidity in [pass_quote_liquidity, fail_quote_liquidity] {
            require_gte!(
                quote_liquidity,
                dao.min_quote_futarchic_liquidity,
                AutocratError::InsufficientLpTokenLock
            );
        }

        for (amount, from, to) in [
            (
                pass_lp_tokens_to_lock,
                &pass_lp_user_account,
                &pass_lp_vault_account,
            ),
            (
                fail_lp_tokens_to_lock,
                &fail_lp_user_account,
                &fail_lp_vault_account,
            ),
        ] {
            token::transfer(
                CpiContext::new(
                    token_program.to_account_info(),
                    Transfer {
                        from: from.to_account_info(),
                        to: to.to_account_info(),
                        authority: proposer.to_account_info(),
                    },
                ),
                amount,
            )?;
        }
=======
        let InitializeProposalParams { nonce } = params;
>>>>>>> af0016f (Get basic swap + conditional swap accounting working)

        let clock = Clock::get()?;

        dao.proposal_count += 1;

        proposal.set_inner(Proposal {
            number: dao.proposal_count,
            squads_proposal: squads_proposal.key(),
            proposer: proposer.key(),
            slot_enqueued: clock.slot,
            state: ProposalState::Pending,
            base_vault: base_vault.key(),
            quote_vault: quote_vault.key(),
            futarchy_amm: futarchy_amm.key(),
            dao: dao.key(),
<<<<<<< HEAD
            pass_lp_tokens_locked: pass_lp_tokens_to_lock,
            fail_lp_tokens_locked: fail_lp_tokens_to_lock,
=======
            nonce,
>>>>>>> af0016f (Get basic swap + conditional swap accounting working)
            pda_bump: ctx.bumps.proposal,
            question: question.key(),
            duration_in_slots: dao.slots_per_proposal,
        });

        // Take half the base and quote reserves from the spot pool and provide it
        // to the pass and fail pools. We don't need to actually do any splits
        // because most of the conditional token reserves are virtual.

        let base_to_provide = futarchy_amm.spot_pool.base_reserves / 2;
        let quote_to_provide = futarchy_amm.spot_pool.quote_reserves / 2;

        futarchy_amm.spot_pool.base_reserves -= base_to_provide;
        futarchy_amm.spot_pool.quote_reserves -= quote_to_provide;

        futarchy_amm.live_proposal = Some(LiveProposalDetails {
            proposal: proposal.key(),
            question: question.key(),
<<<<<<< HEAD
            pass_amm: pass_amm.key(),
            fail_amm: fail_amm.key(),
            base_vault: base_vault.key(),
            quote_vault: quote_vault.key(),
            pass_lp_mint: pass_lp_mint.key(),
            fail_lp_mint: fail_lp_mint.key(),
            proposer: proposer.key(),
            number: dao.proposal_count,
            pass_lp_tokens_locked: pass_lp_tokens_to_lock,
            fail_lp_tokens_locked: fail_lp_tokens_to_lock,
            pda_bump: ctx.bumps.proposal,
            duration_in_slots: proposal.duration_in_slots,
            squads_proposal: squads_proposal.key(),
            squads_multisig: dao.squads_multisig,
            squads_multisig_vault: dao.squads_multisig_vault,
=======
            pass_pool: Pool {
                base_reserves: base_to_provide,
                quote_reserves: quote_to_provide,
            },
            fail_pool: Pool {
                base_reserves: base_to_provide,
                quote_reserves: quote_to_provide,
            },
>>>>>>> af0016f (Get basic swap + conditional swap accounting working)
        });

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
