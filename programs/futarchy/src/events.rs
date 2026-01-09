use anchor_lang::prelude::*;

use crate::{FutarchyAmm, InitialSpendingLimit, Market, ProposalState, SwapType};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
    pub dao_seq_num: u64,
}

impl CommonFields {
    pub fn new(clock: &Clock, dao_seq_num: u64) -> Self {
        Self {
            slot: clock.slot,
            unix_timestamp: clock.unix_timestamp,
            dao_seq_num,
        }
    }
}

#[event]
pub struct CollectFeesEvent {
    pub common: CommonFields,
    pub dao: Pubkey,
    pub base_token_account: Pubkey,
    pub quote_token_account: Pubkey,
    pub amm_base_vault: Pubkey,
    pub amm_quote_vault: Pubkey,
    pub quote_mint: Pubkey,
    pub base_mint: Pubkey,
    pub quote_fees_collected: u64,
    pub base_fees_collected: u64,
    pub post_amm_state: FutarchyAmm,
}

#[event]
pub struct InitializeDaoEvent {
    pub common: CommonFields,
    pub dao: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub pass_threshold_bps: u16,
    pub seconds_per_proposal: u32,
    pub twap_initial_observation: u128,
    pub twap_max_observation_change_per_update: u128,
    pub twap_start_delay_seconds: u32,
    pub min_quote_futarchic_liquidity: u64,
    pub min_base_futarchic_liquidity: u64,
    pub base_to_stake: u64,
    pub initial_spending_limit: Option<InitialSpendingLimit>,
    pub squads_multisig: Pubkey,
    pub squads_multisig_vault: Pubkey,
    pub team_sponsored_pass_threshold_bps: i16,
    pub team_address: Pubkey,
}

#[event]
pub struct UpdateDaoEvent {
    pub common: CommonFields,
    pub dao: Pubkey,
    pub pass_threshold_bps: u16,
    pub seconds_per_proposal: u32,
    pub twap_initial_observation: u128,
    pub twap_max_observation_change_per_update: u128,
    pub twap_start_delay_seconds: u32,
    pub min_quote_futarchic_liquidity: u64,
    pub min_base_futarchic_liquidity: u64,
    pub base_to_stake: u64,
    pub team_sponsored_pass_threshold_bps: i16,
    pub team_address: Pubkey,
    pub is_optimistic_governance_enabled: bool,
}

#[event]
pub struct InitializeProposalEvent {
    pub common: CommonFields,
    pub proposal: Pubkey,
    pub dao: Pubkey,
    pub question: Pubkey,
    pub quote_vault: Pubkey,
    pub base_vault: Pubkey,
    pub proposer: Pubkey,
    pub number: u32,
    pub pda_bump: u8,
    pub duration_in_seconds: u32,
    pub squads_proposal: Pubkey,
    pub squads_multisig: Pubkey,
    pub squads_multisig_vault: Pubkey,
}

#[event]
pub struct StakeToProposalEvent {
    pub common: CommonFields,
    pub proposal: Pubkey,
    pub staker: Pubkey,
    pub amount: u64,
    pub total_staked: u64,
}

#[event]
pub struct UnstakeFromProposalEvent {
    pub common: CommonFields,
    pub proposal: Pubkey,
    pub staker: Pubkey,
    pub amount: u64,
    pub total_staked: u64,
}

#[event]
pub struct LaunchProposalEvent {
    pub common: CommonFields,
    pub proposal: Pubkey,
    pub dao: Pubkey,
    pub timestamp_enqueued: i64,
    pub total_staked: u64,
    pub post_amm_state: FutarchyAmm,
}

#[event]
pub struct FinalizeProposalEvent {
    pub common: CommonFields,
    pub proposal: Pubkey,
    pub dao: Pubkey,
    pub pass_market_twap: u128,
    pub fail_market_twap: u128,
    pub threshold: u128,
    pub state: ProposalState,
    pub squads_proposal: Pubkey,
    pub squads_multisig: Pubkey,
    pub post_amm_state: FutarchyAmm,
    pub is_team_sponsored: bool,
}

#[event]
pub struct SpotSwapEvent {
    pub common: CommonFields,
    pub dao: Pubkey,
    pub user: Pubkey,
    pub swap_type: SwapType,
    pub input_amount: u64,
    pub output_amount: u64,
    pub min_output_amount: u64,
    pub post_amm_state: FutarchyAmm,
}

#[event]
pub struct ConditionalSwapEvent {
    pub common: CommonFields,
    pub dao: Pubkey,
    pub proposal: Pubkey,
    pub trader: Pubkey,
    pub market: Market,
    pub swap_type: SwapType,
    pub input_amount: u64,
    pub output_amount: u64,
    pub min_output_amount: u64,
    pub post_amm_state: FutarchyAmm,
}

#[event]
pub struct ProvideLiquidityEvent {
    pub common: CommonFields,
    pub dao: Pubkey,
    pub liquidity_provider: Pubkey,
    pub position_authority: Pubkey,
    pub quote_amount: u64,
    pub base_amount: u64,
    pub liquidity_minted: u128,
    pub min_liquidity: u128,
    pub post_amm_state: FutarchyAmm,
}

#[event]
pub struct WithdrawLiquidityEvent {
    pub common: CommonFields,
    pub dao: Pubkey,
    pub liquidity_provider: Pubkey,
    pub liquidity_withdrawn: u128,
    pub min_base_amount: u64,
    pub min_quote_amount: u64,
    pub base_amount: u64,
    pub quote_amount: u64,
    pub post_amm_state: FutarchyAmm,
}

#[event]
pub struct SponsorProposalEvent {
    pub common: CommonFields,
    pub proposal: Pubkey,
    pub dao: Pubkey,
    pub team_address: Pubkey,
}

#[event]
pub struct CollectMeteoraDammFeesEvent {
    pub common: CommonFields,
    pub dao: Pubkey,
    pub pool: Pubkey,
    pub base_token_account: Pubkey,
    pub quote_token_account: Pubkey,
    pub quote_mint: Pubkey,
    pub base_mint: Pubkey,
    pub quote_fees_collected: u64,
    pub base_fees_collected: u64,
}

#[event]
pub struct InitiateVaultSpendOptimisticProposalEvent {
    pub common: CommonFields,
    pub dao: Pubkey,
    pub proposer: Pubkey,
    pub squads_proposal: Pubkey,
    pub squads_multisig: Pubkey,
    pub squads_multisig_vault: Pubkey,
    pub amount: u64,
    pub recipient: Pubkey,
    pub dao_quote_vault_account: Pubkey,
    pub recipient_quote_account: Pubkey,
    pub enqueued_timestamp: i64,
}
