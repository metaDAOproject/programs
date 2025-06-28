use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::state::{FutarchyAmm, Dao, Side};

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct SwapParams {
    pub side: Side,
    pub amount_in: u64,
}

#[derive(Accounts)]
#[event_cpi]
pub struct Swap<'info> {
    #[account(mut)]
    pub futarchy_amm: Account<'info, FutarchyAmm>,
    pub trader: Signer<'info>,
    pub trader_base_account: Account<'info, TokenAccount>,
    pub trader_quote_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl Swap<'_> {
    pub fn handle(ctx: Context<Self>, params: SwapParams) -> Result<()> {
        let SwapParams { side, amount_in } = params;

        let futarchy_amm = &mut ctx.accounts.futarchy_amm;

        futarchy_amm.swap(side, amount_in)?;

        Ok(())
    }
}
