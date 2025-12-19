use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct BidWall {
    /// The nonce of the bid wall.
    pub nonce: u64,
    /// When the bid wall was created.
    pub created_timestamp: i64,
    /// The initial quote (USDC) reserves of the Futarchy AMM.
    pub initial_amm_quote_reserves: u64,
    /// The current amount of quote tokens assigned to the bid wall.
    /// This is different from the amount in the bid wall quote token account,
    /// because anyone can transfer quote tokens to the bid wall, and we don't want that to affect the bid wall's NAV calculation.
    pub quote_amount: u64,
    /// The fees collected by the bid wall.
    pub fees_collected: u64,
    /// The amount of base tokens bought up by the bid wall.
    pub base_bought_amount: u64,
    /// The event sequence number of the bid wall.
    pub seq_num: u64,
    /// The authority of the bid wall.
    pub creator: Pubkey,
    /// The authority of the bid wall.
    pub authority: Pubkey,
    /// The DAO treasury address.
    pub dao_treasury: Pubkey,
    /// The mint of the token being sold into the bid wall.
    pub base_mint: Pubkey,
    /// The recipient of the fees collected by the bid wall.
    pub fee_recipient: Pubkey,
    /// The minimum duration in seconds before the bid wall can be closed.
    pub duration_seconds: u32,
    /// The PDA bump.
    pub pda_bump: u8,
}
