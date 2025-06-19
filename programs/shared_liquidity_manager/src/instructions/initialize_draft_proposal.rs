use anchor_lang::prelude::*;

use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::{AssociatedToken, get_associated_token_address};

use crate::state::{DraftProposal, DraftProposalStatus, ProposalInstruction, SharedLiquidityPool};

use autocrat::state::Dao;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeDraftProposalParams {
    pub instruction: ProposalInstruction,
    /// The nonce for the draft proposal, not used for anything aside from the PDA
    pub draft_proposal_nonce: u64,
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(args: InitializeDraftProposalParams)]
pub struct InitializeDraftProposal<'info> {
    #[account(
        init,
        payer = payer,
        space = 1500,
        seeds = [b"draft_proposal", args.draft_proposal_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub draft_proposal: Box<Account<'info, DraftProposal>>,
    #[account(has_one = base_mint)]
    pub shared_liquidity_pool: Box<Account<'info, SharedLiquidityPool>>,
    pub base_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = base_mint,
        associated_token::authority = draft_proposal,
    )]
    pub staked_token_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl InitializeDraftProposal<'_> {
    pub fn handle(ctx: Context<Self>, params: InitializeDraftProposalParams) -> Result<()> {
        ctx.accounts.draft_proposal.set_inner(DraftProposal {
            instruction: params.instruction,
            staked_token_amount: 0,
            status: DraftProposalStatus::Draft,
            staked_token_vault: ctx.accounts.staked_token_vault.key(),
            shared_liquidity_pool: ctx.accounts.shared_liquidity_pool.key(),
            pda_bump: ctx.bumps.draft_proposal,
        });

        Ok(())
    }
}
