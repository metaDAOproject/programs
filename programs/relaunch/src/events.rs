use anchor_lang::prelude::*;

use crate::state::RelaunchState;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
    pub relaunch_seq_num: u64,
}

impl CommonFields {
    pub fn new(clock: &Clock, relaunch_seq_num: u64) -> Self {
        Self {
            slot: clock.slot,
            unix_timestamp: clock.unix_timestamp,
            relaunch_seq_num,
        }
    }
}

#[event]
pub struct RelaunchInitializedEvent {
    pub common: CommonFields,
    pub relaunch: Pubkey,
    pub admin: Pubkey,
    pub new_mint: Pubkey,
    pub old_mint: Pubkey,
    pub source_pool: Pubkey,
    pub source_quote_mint: Pubkey,
    pub relaunch_signer: Pubkey,
    pub relaunch_signer_bump: u8,
    pub old_token_vault: Pubkey,
    pub new_token_vault: Pubkey,
    pub source_quote_vault: Pubkey,
    pub usdc_vault: Pubkey,
    pub threshold_bps: u16,
    pub old_supply_snapshot: u64,
    pub seconds_for_deposits: u32,
    pub grace_period_seconds: u32,
    pub monthly_spending_limit_amount: u64,
    pub monthly_spending_limit_members: Vec<Pubkey>,
    pub team_address: Pubkey,
    pub pda_bump: u8,
}

#[event]
pub struct DepositsStartedEvent {
    pub common: CommonFields,
    pub relaunch: Pubkey,
    pub admin: Pubkey,
}

#[event]
pub struct TokensDepositedEvent {
    pub common: CommonFields,
    pub relaunch: Pubkey,
    pub depositor: Pubkey,
    pub deposit_record: Pubkey,
    pub amount: u64,
    pub total_deposited: u64,
    pub total_deposited_by_depositor: u64,
    pub deposit_record_seq_num: u64,
}

#[event]
pub struct DepositsClosedEvent {
    pub common: CommonFields,
    pub relaunch: Pubkey,
    pub new_state: RelaunchState,
}

#[event]
pub struct RelaunchMarkedFailedEvent {
    pub common: CommonFields,
    pub relaunch: Pubkey,
}

#[event]
pub struct SellExecutedEvent {
    pub common: CommonFields,
    pub relaunch: Pubkey,
    pub base_sold: u64,
    pub quote_recovered: u64,
    pub new_state: RelaunchState,
}

#[event]
pub struct UsdcSwapExecutedEvent {
    pub common: CommonFields,
    pub relaunch: Pubkey,
    pub wsol_sold: u64,
    pub usdc_recovered: u64,
}

#[event]
pub struct RefundClaimedEvent {
    pub common: CommonFields,
    pub relaunch: Pubkey,
    pub depositor: Pubkey,
    pub deposit_record: Pubkey,
    pub amount_refunded: u64,
    pub deposit_record_seq_num: u64,
}

#[event]
pub struct TokensDepositedViaBuyEvent {
    pub common: CommonFields,
    pub relaunch: Pubkey,
    pub depositor: Pubkey,
    pub deposit_record: Pubkey,
    /// The old tokens bought and credited (the measured old-vault delta).
    pub amount: u64,
    /// The quote consumed by the buy, inclusive of pump's fees.
    pub quote_spent: u64,
    pub total_deposited: u64,
    pub total_deposited_by_depositor: u64,
    pub deposit_record_seq_num: u64,
}
