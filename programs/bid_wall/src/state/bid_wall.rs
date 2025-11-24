use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct BidWall {
    /// The PDA bump.
    pub pda_bump: u8,
    /// The authority of the bid wall.
    pub authority: Pubkey,
    /// The mint of the token being sold into the bid wall.
    pub base_mint: Pubkey,
    /// The related DAO.
    pub dao: Pubkey,
    /// The DAO's Meteora CPMM pool
    pub pool: Pubkey,
    /// The DAO's Meteora CPMM position
    pub position: Pubkey,
    /// When the bid wall was created.
    pub created_timestamp: i64,
    /// The minimum duration in seconds before the bid wall can be closed.
    pub min_duration: u32,
}
