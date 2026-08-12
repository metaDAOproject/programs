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

impl DepositRecord {
    /// Credits a deposit, initializing the record on first use: a fresh
    /// record holds the default pubkey, an existing one holds the
    /// depositor's pubkey.
    pub fn credit(&mut self, relaunch: Pubkey, depositor: Pubkey, amount: u64, pda_bump: u8) {
        if self.depositor == depositor {
            self.amount_deposited += amount;
            self.seq_num += 1;
        } else {
            *self = DepositRecord {
                relaunch,
                depositor,
                amount_deposited: amount,
                claimed: false,
                seq_num: 0,
                pda_bump,
            };
        }
    }
}
