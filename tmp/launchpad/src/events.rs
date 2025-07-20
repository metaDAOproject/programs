use crate::state::LaunchState;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
    pub launch_seq_num: u64,
}

impl CommonFields {
    pub fn new(clock: &Clock, launch_seq_num: u64) -> Self {
        Self {
            slot: clock.slot,
            unix_timestamp: clock.unix_timestamp,
            launch_seq_num,
        }
    }
}

#[event]
pub struct LaunchInitializedEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub minimum_raise_amount: u64,
    pub launch_authority: Pubkey,
    pub launch_signer: Pubkey,
    pub launch_signer_pda_bump: u8,
    pub launch_usdc_vault: Pubkey,
    pub launch_token_vault: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub pda_bump: u8,
    pub seconds_for_launch: u32,
}

#[event]
pub struct LaunchStartedEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub launch_authority: Pubkey,
    pub slot_started: u64,
}

#[event]
pub struct LaunchFundedEvent {
    pub common: CommonFields,
    pub funding_record: Pubkey,
    pub launch: Pubkey,
    pub funder: Pubkey,
    pub amount: u64,
    pub total_committed_by_funder: u64,
    pub total_committed: u64,
    pub funding_record_seq_num: u64,
}

#[event]
pub struct LaunchCompletedEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub final_state: LaunchState,
    pub total_committed: u64,
    pub dao: Option<Pubkey>,
    pub dao_treasury: Option<Pubkey>,
}

#[event]
pub struct LaunchRefundedEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub funder: Pubkey,
    pub usdc_refunded: u64,
    pub funding_record: Pubkey,
}

#[event]
pub struct LaunchClaimEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub funder: Pubkey,
    pub tokens_claimed: u64,
    pub funding_record: Pubkey,
}
