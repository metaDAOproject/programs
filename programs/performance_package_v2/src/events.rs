use anchor_lang::prelude::*;

use crate::{OracleReader, RewardFunction};

/// Common fields included in all events for consistent metadata.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
    pub performance_package_seq_num: u64,
}

/// Emitted by: `initialize_performance_package`
#[event]
pub struct PerformancePackageCreatedEvent {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub mint: Pubkey,
    pub mint_governor: Pubkey,
    pub authority: Pubkey,
    pub recipient: Pubkey,
    pub create_key: Pubkey,
    pub pda_bump: u8,
    pub oracle_reader: OracleReader,
    pub reward_function: RewardFunction,
    pub min_unlock_timestamp: i64,
    pub pp_created_at_timestamp: i64,
}

/// Emitted by: `start_unlock`
#[event]
pub struct UnlockStartedEvent {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub start_time: i64,
    pub start_oracle_value: u128,
    pub pp_created_at_timestamp: i64,
}

/// Emitted by: `complete_unlock`
#[event]
pub struct UnlockCompletedEvent {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub oracle_value: u128,
    pub recipient: Pubkey,
    pub amount_minted: u64,
    /// Cumulative after this unlock
    pub total_rewards_paid_out: u64,
    pub pp_created_at_timestamp: i64,
}

/// Emitted by: `change_authority`
#[event]
pub struct AuthorityChangedEvent {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
    pub pp_created_at_timestamp: i64,
}

/// Emitted by: `propose_change`
#[event]
pub struct ChangeProposedEvent {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub change_request: Pubkey,
    pub proposer: Pubkey,
    pub pda_nonce: u32,
    pub new_recipient: Option<Pubkey>,
    pub new_oracle_reader: Option<OracleReader>,
    pub new_reward_function: Option<RewardFunction>,
    /// `PerformancePackage.created_at_timestamp` as stamped onto the ChangeRequest
    pub pp_created_at_timestamp: i64,
}

/// Emitted by: `execute_change`
#[event]
pub struct ChangeExecutedEvent {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub executed_by: Pubkey,
    pub new_recipient: Option<Pubkey>,
    pub new_oracle_reader: Option<OracleReader>,
    pub new_reward_function: Option<RewardFunction>,
    /// The ChangeRequest PDA that was executed (and closed) by this instruction
    pub change_request: Pubkey,
    pub pp_created_at_timestamp: i64,
}

/// Emitted by: `close_performance_package`
#[event]
pub struct PerformancePackageClosedEvent {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    /// Final cumulative amount paid
    pub total_rewards_paid_out: u64,
    pub pp_created_at_timestamp: i64,
}
