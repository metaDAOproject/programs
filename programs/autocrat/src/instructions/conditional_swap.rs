
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::{state::{Condition, FutarchyAmm, Side}, AutocratError};

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct ConditionalSwapParams {
    pub side: Side,
    pub condition: Condition,
    pub amount_in: u64,
}

// Safe against a case where someone switches out proposals mid-flight because these accounts
// wouldn't work
#[derive(Accounts)]
#[event_cpi]
pub struct ConditionalSwap<'info> {
    #[account(mut)]
    pub futarchy_amm: Account<'info, FutarchyAmm>,
    pub trader: Signer<'info>,
    pub trader_base_account: Account<'info, TokenAccount>,
    pub trader_quote_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl ConditionalSwap<'_> {
    pub fn validate(&self) -> Result<()> {
        let futarchy_amm = &self.futarchy_amm;

        require!(futarchy_amm.live_proposal.is_some(), AutocratError::ProposalNotLive);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: ConditionalSwapParams) -> Result<()> {
        let ConditionalSwapParams { side, condition, amount_in } = params;

        let futarchy_amm = &mut ctx.accounts.futarchy_amm;
        let live_proposal = futarchy_amm.live_proposal.as_mut().unwrap();

        let pool = match condition {
            Condition::Pass => &mut live_proposal.pass_pool,
            Condition::Fail => &mut live_proposal.fail_pool,
        };

        pool.feeless_swap(amount_in, side)?;

        // futarchy_amm.swap(side, amount_in)?;

        Ok(())
    }
}
