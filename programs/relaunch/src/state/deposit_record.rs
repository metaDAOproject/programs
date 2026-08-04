use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct DepositRecord {
    /// The relaunch this record belongs to.
    pub relaunch: Pubkey,
    /// The depositor.
    pub depositor: Pubkey,
    /// The amount of old tokens deposited, including tokens bought via
    /// `deposit_via_buy`.
    pub amount_deposited: u64,
    /// Whether the record has been settled by `claim` / `claim_refund`.
    pub claimed: bool,
    /// The sequence number of this record. Useful for sorting events.
    pub seq_num: u64,
    /// The PDA bump.
    pub pda_bump: u8,
}
