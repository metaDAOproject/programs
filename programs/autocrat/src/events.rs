use anchor_lang::prelude::*;

use crate::{InitialSpendingLimit, ProposalState};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
}

impl CommonFields {
    pub fn new(clock: &Clock) -> Self {
        Self {
            slot: clock.slot,
            unix_timestamp: clock.unix_timestamp,
        }
    }
}

#[event]
pub struct InitializeDaoEvent {
    pub common: CommonFields,
    pub dao: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub pass_threshold_bps: u16,
    pub slots_per_proposal: u64,
    pub twap_initial_observation: u128,
    pub twap_max_observation_change_per_update: u128,
    pub min_quote_futarchic_liquidity: u64,
    pub min_base_futarchic_liquidity: u64,
    pub initial_spending_limit: Option<InitialSpendingLimit>,
    pub squads_multisig: Pubkey,
    pub squads_multisig_vault: Pubkey,
}

#[event]
pub struct UpdateDaoEvent {
    pub common: CommonFields,
    pub dao: Pubkey,
    pub pass_threshold_bps: u16,
    pub slots_per_proposal: u64,
    pub twap_initial_observation: u128,
    pub twap_max_observation_change_per_update: u128,
    pub min_quote_futarchic_liquidity: u64,
    pub min_base_futarchic_liquidity: u64,
}

#[event]
pub struct InitializeProposalEvent {
    pub common: CommonFields,
    pub proposal: Pubkey,
    pub dao: Pubkey,
    pub question: Pubkey,
    pub quote_vault: Pubkey,
    pub base_vault: Pubkey,
    pub pass_amm: Pubkey,
    pub fail_amm: Pubkey,
    pub pass_lp_mint: Pubkey,
    pub fail_lp_mint: Pubkey,
    pub proposer: Pubkey,
    pub number: u32,
    pub pass_lp_tokens_locked: u64,
    pub fail_lp_tokens_locked: u64,
    pub pda_bump: u8,
    pub duration_in_slots: u64,
    pub squads_proposal: Pubkey,
    pub squads_multisig: Pubkey,
    pub squads_multisig_vault: Pubkey,
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
}

#[event]
pub struct ExecuteProposalEvent {
    pub common: CommonFields,
    pub proposal: Pubkey,
    pub dao: Pubkey,
}

#[event]
pub struct WithdrawLiquidityEvent {
    pub common: CommonFields,
    pub futarchy_amm: Pubkey,
    pub liquidity_provider: Pubkey,
    pub liquidity_withdrawn: u128,
    pub min_base_amount: u64,
    pub min_quote_amount: u64,
    pub base_amount: u64,
    pub quote_amount: u64,
}
