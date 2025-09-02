use anchor_lang::prelude::*;
use crate::OracleConfig;

#[event]
pub struct LockerInitialized {
    pub locker: Pubkey,
    pub price_threshold: u128,
    pub token_amount: u64,
    pub unlock_timestamp: i64,
    pub oracle_config: OracleConfig,
    pub token_recipient: Pubkey,
}

#[event]
pub struct UnlockStarted {
    pub locker: Pubkey,
    pub start_aggregator: u128,
    pub start_timestamp: i64,
}

#[event]
pub struct UnlockCompleted {
    pub locker: Pubkey,
    pub token_amount: u64,
    pub recipient: Pubkey,
    pub twap_price: u128,
    pub price_threshold: u128,
}
