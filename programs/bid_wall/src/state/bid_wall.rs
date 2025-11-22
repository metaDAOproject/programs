use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct BidWall {
    /// The PDA bump.
    pub pda_bump: u8,
    /// The authority of the bid wall.
    pub authority: Pubkey,
    /// The launch.
    pub mint: Pubkey,
    /// When the bid wall was created.
    pub created_timestamp: i64,
    /// The duration of the bid wall in seconds.
    pub duration: u32,
}
