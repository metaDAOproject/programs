use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};

use crate::state::{DraftProposal, StakeRecord};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct StakeToDraftProposalParams {
    pub amount: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct StakeToDraftProposal<'info> {
    #[account(mut, has_one = staked_token_vault)]
    pub draft_proposal: Account<'info, DraftProposal>,
    pub staker: Signer<'info>,
    #[account(mut, associated_token::mint = draft_proposal.base_mint, associated_token::authority = staker)]
    pub staker_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub staked_token_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(init_if_needed, payer = payer, space = 8 + std::mem::size_of::<StakeRecord>(), seeds = [b"stake_record", draft_proposal.key().as_ref(), staker.key().as_ref()], bump)]
    pub stake_record: Account<'info, StakeRecord>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl StakeToDraftProposal<'_> {
    pub fn handle(ctx: Context<Self>, params: StakeToDraftProposalParams) -> Result<()> {
        require_gte!(
            ctx.accounts.staker_token_account.amount,
            params.amount
        );

        anchor_spl::token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.staker_token_account.to_account_info(),
                    to: ctx.accounts.staked_token_vault.to_account_info(),
                    authority: ctx.accounts.staker.to_account_info(),
                }
            ),
            params.amount)?;

        ctx.accounts.stake_record.staker = ctx.accounts.staker.key();
        ctx.accounts.stake_record.amount += params.amount;

        ctx.accounts.draft_proposal.staked_token_amount += params.amount;

        Ok(())
    }
}