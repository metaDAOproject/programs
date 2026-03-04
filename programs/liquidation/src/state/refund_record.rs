use anchor_lang::prelude::*;

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
