use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Liquidation {
    /// Arbitrary keypair used to make the PDA unique.
    pub create_key: Pubkey,
    /// The address that can create and modify RefundRecords during setup.
    pub record_authority: Pubkey,
    /// The address that activates the liquidation and receives remaining quote tokens post-deadline.
    pub liquidation_authority: Pubkey,
    /// The project token mint (tokens to be burned).
    pub base_mint: Pubkey,
    /// The refund token mint (USDC).
    pub quote_mint: Pubkey,
    /// Sum of all RefundRecord quote_refundable values.
    pub total_quote_refundable: u64,
    /// Sum of all quote tokens actually transferred to users so far.
    pub total_quote_refunded: u64,
    /// Sum of all RefundRecord base_assigned values.
    pub total_base_assigned: u64,
    /// Sum of all base tokens actually burned so far.
    pub total_base_burned: u64,
    /// Unix timestamp when ActivateLiquidation was called. 0 before activation.
    pub started_at: i64,
    /// How long the refund window lasts after activation.
    pub duration_seconds: u32,
    /// Event sequence number for indexing.
    pub seq_num: u64,
    /// Whether refunds are currently enabled.
    pub is_refunding: bool,
    /// PDA bump seed.
    pub pda_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RefundRecord {
    /// The parent Liquidation account.
    pub liquidation: Pubkey,
    /// The user this record belongs to.
    pub recipient: Pubkey,
    /// Total base tokens this user is eligible to burn.
    pub base_assigned: u64,
    /// Base tokens this user has burned so far.
    pub base_burned: u64,
    /// Total quote tokens this user can receive if they burn all assigned base.
    pub quote_refundable: u64,
    /// Quote tokens already transferred to this user.
    pub quote_refunded: u64,
    /// PDA bump seed.
    pub pda_bump: u8,
}
