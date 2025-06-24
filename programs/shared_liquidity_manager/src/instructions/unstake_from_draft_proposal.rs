use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};

use crate::state::{DraftProposal, StakeRecord};
use crate::error::SharedLiquidityManagerError;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UnstakeFromDraftProposalParams {
    pub amount: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct UnstakeFromDraftProposal<'info> {
    #[account(mut, has_one = staked_token_vault)]
    pub draft_proposal: Account<'info, DraftProposal>,
    pub staker: Signer<'info>,
    #[account(mut, associated_token::mint = draft_proposal.base_mint, associated_token::authority = staker)]
    pub staker_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub staked_token_vault: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"stake_record", draft_proposal.key().as_ref(), staker.key().as_ref()], bump)]
    pub stake_record: Account<'info, StakeRecord>,
    pub token_program: Program<'info, Token>,
}

impl UnstakeFromDraftProposal<'_> {
    pub fn validate(&self, params: &UnstakeFromDraftProposalParams) -> Result<()> {
        require_gte!(
            self.stake_record.amount,
            params.amount,
            SharedLiquidityManagerError::InsufficientStake
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: UnstakeFromDraftProposalParams) -> Result<()> {
        // Transfer tokens from staked vault back to staker
        // The draft_proposal account itself is the authority for the staked_token_vault
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.staked_token_vault.to_account_info(),
                    to: ctx.accounts.staker_token_account.to_account_info(),
                    authority: ctx.accounts.draft_proposal.to_account_info(),
                },
                &[&[
                    b"draft_proposal",
                    &ctx.accounts.draft_proposal.nonce.to_le_bytes(),
                    &[ctx.accounts.draft_proposal.pda_bump],
                ]],
            ),
            params.amount,
        )?;

        // Update stake record
        ctx.accounts.stake_record.amount -= params.amount;

        // Update draft proposal staked amount
        ctx.accounts.draft_proposal.staked_token_amount -= params.amount;

        Ok(())
    }
}

