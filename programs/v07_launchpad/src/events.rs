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
    pub performance_package_grantee: Pubkey,
    pub performance_package_token_amount: u64,
    pub months_until_insiders_can_unlock: u8,
    pub monthly_spending_limit_amount: u64,
    pub monthly_spending_limit_members: Vec<Pubkey>,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub pda_bump: u8,
    pub seconds_for_launch: u32,
    pub additional_tokens_amount: u64,
    pub additional_tokens_recipient: Option<Pubkey>,
    pub accumulator_activation_delay_seconds: u32,
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
    pub committed_amount_accumulator: u128,
}

#[event]
pub struct FundingRecordApprovalSetEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub funding_record: Pubkey,
    pub funder: Pubkey,
    pub approved_amount: u64,
    pub total_approved: u64,
}

#[event]
pub struct LaunchCompletedEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub final_state: LaunchState,
    pub total_committed: u64,
    pub dao: Option<Pubkey>,
    pub dao_treasury: Option<Pubkey>,
    pub total_approved_amount: u64,
    pub bid_wall: Option<Pubkey>,
    pub bid_wall_amount: u64,
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

#[event]
pub struct LaunchCloseEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub new_state: LaunchState,
}

#[event]
pub struct LaunchClaimAdditionalTokenAllocationEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub additional_tokens_amount: u64,
    pub additional_tokens_recipient: Pubkey,
}

#[event]
pub struct LaunchPerformancePackageInitializedEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub performance_package: Pubkey,
}
