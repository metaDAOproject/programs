use super::*;

use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct StakeToProposalParams {
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(args: StakeToProposalParams)]
#[event_cpi]
pub struct StakeToProposal<'info> {
    #[account(mut)]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(
        mut,
        associated_token::mint = dao.base_mint,
        associated_token::authority = staker,
    )]
    pub staker_base_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = dao.base_mint,
        associated_token::authority = proposal,
    )]
    pub proposal_base_account: Box<Account<'info, TokenAccount>>,
    pub staker: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl StakeToProposal<'_> {
    pub fn validate(&self, params: &StakeToProposalParams) -> Result<()> {
        require!(
            matches!(self.proposal.state, ProposalState::Draft { .. }),
            AutocratError::ProposalNotInDraftState
        );

        require_keys_eq!(self.proposal.dao, self.dao.key());

        require_gte!(
            self.staker_base_account.amount,
            params.amount,
            AutocratError::InsufficientTokenBalance
        );

        require_gt!(params.amount, 0, AutocratError::InvalidAmount);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: StakeToProposalParams) -> Result<()> {
        let Self {
            proposal,
            dao: _,
            staker_base_account,
            proposal_base_account,
            staker,
            token_program,
            associated_token_program: _,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let StakeToProposalParams { amount } = params;

        // Transfer tokens from staker to proposal
        let transfer_ctx = CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: staker_base_account.to_account_info(),
                to: proposal_base_account.to_account_info(),
                authority: staker.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;

        // Update proposal state
        if let ProposalState::Draft { mut amount_staked } = proposal.state {
            amount_staked += amount;
            proposal.state = ProposalState::Draft { amount_staked };
        }

        // Update stakers list
        let staker_key = staker.key();
        let mut found = false;
        for staker_record in &mut proposal.stakers {
            if staker_record.staker == staker_key {
                staker_record.amount += amount;
                found = true;
                break;
            }
        }

        if !found {
            proposal.stakers.push(StakerRecord {
                staker: staker_key,
                amount,
            });
        }

        let clock = Clock::get()?;

        emit_cpi!(StakeToProposalEvent {
            common: CommonFields::new(&clock),
            proposal: proposal.key(),
            staker: staker.key(),
            amount,
            total_staked: match proposal.state {
                ProposalState::Draft { amount_staked } => amount_staked,
                _ => unreachable!(),
            },
        });

        Ok(())
    }
}
