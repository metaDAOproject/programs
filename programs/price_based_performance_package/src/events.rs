use crate::ChangeType;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
    pub performance_package_seq_num: u64,
}

impl CommonFields {
    pub fn new(clock: &Clock, performance_package_seq_num: u64) -> Self {
        Self {
            slot: clock.slot,
            unix_timestamp: clock.unix_timestamp,
            performance_package_seq_num,
        }
    }
}

#[event]
pub struct PerformancePackageInitialized {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    // TODO: see CU gain of not including this
    // pub performance_package_data: PerformancePackage,
}

#[event]
pub struct UnlockStarted {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub start_aggregator: u128,
    pub start_timestamp: i64,
}

#[event]
pub struct UnlockCompleted {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub token_amount: u64,
    pub recipient: Pubkey,
    pub twap_price: u128,
}

#[event]
pub struct ChangeProposed {
    pub common: CommonFields,
    pub locker: Pubkey,
    pub change_request: Pubkey,
    pub proposer: Pubkey,
    pub change_type: ChangeType,
}

#[event]
pub struct ChangeExecuted {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub change_request: Pubkey,
    pub executor: Pubkey,
    pub change_type: ChangeType,
}

#[event]
pub struct PerformancePackageAuthorityChanged {
    pub common: CommonFields,
    pub locker: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}
