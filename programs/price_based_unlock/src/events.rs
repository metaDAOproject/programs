use anchor_lang::prelude::*;
use crate::{OracleConfig, ChangeType};

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

#[event]
pub struct TokensClaimed {
    pub locker: Pubkey,
    pub recipient: Pubkey,
    pub tokens_claimed: u64,
    pub tokens_already_unlocked: u64,
    pub total_token_amount: u64,
    pub current_price: u128,
    pub unlock_percentage: u128,
}

#[event]
pub struct ChangeProposed {
    pub locker: Pubkey,
    pub change_request: Pubkey,
    pub proposer: Pubkey,
    pub change_type: ChangeType,
    pub proposed_at: i64,
}

#[event]
pub struct ChangeExecuted {
    pub locker: Pubkey,
    pub change_request: Pubkey,
    pub executor: Pubkey,
    pub change_type: ChangeType,
    pub executed_at: i64,
}

#[event]
pub struct LockerAuthorityChanged {
    pub locker: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
    pub changed_at: i64,
}
