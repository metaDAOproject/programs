use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
    pub liquidation_seq_num: u64,
}

impl CommonFields {
    pub fn new(clock: &Clock, liquidation_seq_num: u64) -> Self {
        Self {
            slot: clock.slot,
            unix_timestamp: clock.unix_timestamp,
            liquidation_seq_num,
        }
    }
}

#[event]
pub struct LiquidationCreatedEvent {
    pub common: CommonFields,
    pub liquidation: Pubkey,
    pub record_authority: Pubkey,
    pub liquidation_authority: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub duration_seconds: u32,
    pub pda_bump: u8,
}

#[event]
pub struct LiquidationActivatedEvent {
    pub common: CommonFields,
    pub liquidation: Pubkey,
    pub total_quote_funded: u64,
    pub started_at: i64,
}

#[event]
pub struct RefundRecordSetEvent {
    pub common: CommonFields,
    pub liquidation: Pubkey,
    pub refund_record: Pubkey,
    pub recipient: Pubkey,
    pub base_assigned: u64,
    pub quote_refundable: u64,
    pub liquidation_total_base_assigned: u64,
    pub liquidation_total_quote_refundable: u64,
    pub pda_bump: u8,
}

#[event]
pub struct RefundEvent {
    pub common: CommonFields,
    pub liquidation: Pubkey,
    pub refund_record: Pubkey,
    pub recipient: Pubkey,
    pub base_burned: u64,
    pub quote_refunded: u64,
    pub post_record_base_burned: u64,
    pub post_record_quote_refunded: u64,
    pub post_liquidation_total_base_burned: u64,
    pub post_liquidation_total_quote_refunded: u64,
}

#[event]
pub struct WithdrawRemainingQuoteEvent {
    pub common: CommonFields,
    pub liquidation: Pubkey,
    pub liquidation_authority: Pubkey,
    pub amount: u64,
}
