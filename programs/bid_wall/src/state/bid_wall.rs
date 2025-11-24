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
    /// The related Meteora CPMM base token vault.
    /// This is the vault into which single-sided liquidity is deposited upon creation.
    pub meteora_cpmm_base_token_vault: Pubkey,
    /// When the bid wall was created.
    pub created_timestamp: i64,
    /// The duration of the bid wall in seconds.
    pub duration: u32,
}
