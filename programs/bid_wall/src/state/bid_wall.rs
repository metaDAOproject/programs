use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct BidWall {
    /// When the bid wall was created.
    pub created_timestamp: i64,
    /// The fees collected by the bid wall.
    pub fees_collected: u64,
    /// The initial base reserves of the Futarchy AMM.
    pub initial_amm_base_reserves: u64,
    /// The initial quote (USDC) reserves of the Futarchy AMM.
    pub initial_amm_quote_reserves: u64,
    /// The initial amount of quote tokens in the DAO treasury.
    pub initial_dao_treasury_quote_amount: u64,
    /// The DAO treasury address.
    pub dao_treasury: Pubkey,
    /// The authority of the bid wall.
    pub authority: Pubkey,
    /// The mint of the token being sold into the bid wall.
    pub base_mint: Pubkey,
    /// The recipient of the fees collected by the bid wall.
    pub fee_recipient: Pubkey,
    /// The minimum duration in seconds before the bid wall can be closed.
    pub duration_seconds: u32,
    /// The PDA bump.
    pub pda_bump: u8,
}
