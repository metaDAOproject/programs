use anchor_lang::prelude::*;

use super::{OracleReader, RewardFunction};

/// Temporary account for two-party approval flow.
/// Seeds: `["change_request", performance_package, proposer, pda_nonce.to_le_bytes()]`
#[account]
#[derive(InitSpace, Debug)]
pub struct ChangeRequest {
    /// The performance package this change applies to
    pub performance_package: Pubkey,
    /// The proposer's pubkey at proposal time
    pub proposer: Pubkey,
    /// PP's created_at_timestamp at proposal time; used to detect stale CRs after close/recreate
    pub pp_created_at_timestamp: i64,
    /// When the change was proposed
    pub proposed_at: i64,
    /// For unique PDA derivation (allows multiple concurrent proposals)
    pub pda_nonce: u32,
    pub bump: u8,

    /// New recipient address (if changing)
    pub new_recipient: Option<Pubkey>,
    /// New oracle configuration (if changing)
    pub new_oracle_reader: Option<OracleReader>,
    /// New reward function (if changing)
    pub new_reward_function: Option<RewardFunction>,
}
