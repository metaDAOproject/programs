use super::*;

use amm::state::ONE_MINUTE_IN_SLOTS;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InitializeProposalParams {
    pub description_url: String,
    pub pass_lp_tokens_to_lock: u64,
    pub fail_lp_tokens_to_lock: u64,
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
    #[account(mut)]
    pub futarchy_amm: Box<Account<'info, FutarchyAmm>>,
    pub squads_proposal: Box<Account<'info, squads_multisig_program::Proposal>>,
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(
        constraint = question.oracle == proposal.key()
    )]
    pub question: Box<Account<'info, Question>>,
    #[account(
        constraint = quote_vault.underlying_token_mint == dao.quote_mint,
        has_one = question,
    )]
    pub quote_vault: Box<Account<'info, ConditionalVaultAccount>>,
    #[account(
        constraint = base_vault.underlying_token_mint == dao.base_mint,
        has_one = question,
    )]
    pub base_vault: Box<Account<'info, ConditionalVaultAccount>>,
    // #[account(
    //     mut,
    //     associated_token::mint = pass_amm.lp_mint,
    //     associated_token::authority = proposer,
    // )]
    // pub pass_lp_user_account: Box<Account<'info, TokenAccount>>,
    // #[account(
    //     mut,
    //     associated_token::mint = fail_amm.lp_mint,
    //     associated_token::authority = proposer,
    // )]
    // pub fail_lp_user_account: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = base_vault.conditional_token_mints[1], associated_token::authority = futarchy_amm)]
    pub amm_pass_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = quote_vault.conditional_token_mints[1], associated_token::authority = futarchy_amm)]
    pub amm_pass_quote_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = base_vault.conditional_token_mints[0], associated_token::authority = futarchy_amm)]
    pub amm_fail_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = quote_vault.conditional_token_mints[0], associated_token::authority = futarchy_amm)]
    pub amm_fail_quote_vault: Box<Account<'info, TokenAccount>>,
    pub proposer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
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
            squads_multisig_program::ProposalStatus::Active { timestamp: _ } => {}
            _ => {
                msg!("squads proposal status: {:?}", self.squads_proposal.status);
                return Err(AutocratError::InvalidSquadsProposalStatus.into());
            }
        }

        // Should never be the case because the oracle is the proposal account, and you can't re-initialize a proposal
        assert!(!self.question.is_resolved());

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: InitializeProposalParams) -> Result<()> {
        let Self {
            base_vault,
            quote_vault,
            question,
            futarchy_amm,
            proposal,
            squads_proposal,
            dao,
            amm_pass_base_vault,
            amm_pass_quote_vault,
            amm_fail_base_vault,
            amm_fail_quote_vault,
            proposer,
            payer: _,
            token_program,
            system_program: _,
            associated_token_program: _,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let InitializeProposalParams {
            description_url,
            pass_lp_tokens_to_lock,
            fail_lp_tokens_to_lock,
        } = params;

        // require_gte!(
        //     pass_lp_user_account.amount,
        //     pass_lp_tokens_to_lock,
        //     AutocratError::InsufficientLpTokenBalance
        // );
        // require_gte!(
        //     fail_lp_user_account.amount,
        //     fail_lp_tokens_to_lock,
        //     AutocratError::InsufficientLpTokenBalance
        // );

        let PoolState::Spot { mut spot } = futarchy_amm.state.to_owned() else { unreachable!() };

        let half_base = spot.base_reserves / 2;
        let half_quote = spot.quote_reserves / 2;

        spot.base_reserves -= half_base;
        spot.quote_reserves -= half_quote;

        let clock = Clock::get()?;

        futarchy_amm.state = PoolState::Futarchy {
            spot,
            pass: Pool {
                base_reserves: half_base,
                quote_reserves: half_quote,
                quote_protocol_fee_balance: 0,
                base_protocol_fee_balance: 0,
                oracle: TwapOracle::new(
                    clock.slot,
                    dao.twap_initial_observation,
                    dao.twap_max_observation_change_per_update,
                    dao.twap_start_delay_slots,
                ),
            },
            fail: Pool {
                base_reserves: half_base,
                quote_reserves: half_quote,
                quote_protocol_fee_balance: 0,
                base_protocol_fee_balance: 0,
                oracle: TwapOracle::new(
                    clock.slot,
                    dao.twap_initial_observation,
                    dao.twap_max_observation_change_per_update,
                    dao.twap_start_delay_slots,
                ),
            },
        };

        let clock = Clock::get()?;

        dao.proposal_count += 1;

        proposal.set_inner(Proposal {
            number: dao.proposal_count,
            squads_proposal: squads_proposal.key(),
            proposer: proposer.key(),
            description_url,
            slot_enqueued: clock.slot,
            state: ProposalState::Pending,
            base_vault: base_vault.key(),
            quote_vault: quote_vault.key(),
            dao: dao.key(),
            pda_bump: ctx.bumps.proposal,
            question: question.key(),
            duration_in_slots: dao.slots_per_proposal,
        });

        emit_cpi!(InitializeProposalEvent {
            common: CommonFields::new(&clock),
            proposal: proposal.key(),
            dao: dao.key(),
            question: question.key(),
            base_vault: base_vault.key(),
            quote_vault: quote_vault.key(),
            proposer: proposer.key(),
            number: dao.proposal_count,
            pda_bump: ctx.bumps.proposal,
            duration_in_slots: proposal.duration_in_slots,
            squads_proposal: squads_proposal.key(),
            squads_multisig: dao.squads_multisig,
            squads_multisig_vault: dao.squads_multisig_vault,
        });

        Ok(())
    }
}
