use anchor_lang::prelude::*;

use crate::{state::SwapType, Amm};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
    pub user: Pubkey,
    pub amm: Pubkey,
    pub post_base_reserves: u64,
    pub post_quote_reserves: u64,
    pub oracle_last_price: u128,
    pub oracle_last_observation: u128,
    pub oracle_aggregator: u128,
    pub seq_num: u64,
}

impl CommonFields {
    pub fn new(clock: &Clock, user: Pubkey, amm: &Account<'_, Amm>) -> Self {
        Self {
            slot: clock.slot,
            unix_timestamp: clock.unix_timestamp,
            user,
            amm: amm.key(),
            post_base_reserves: amm.base_amount,
            post_quote_reserves: amm.quote_amount,
            oracle_last_price: amm.oracle.last_price,
            oracle_last_observation: amm.oracle.last_observation,
            oracle_aggregator: amm.oracle.aggregator,
            seq_num: amm.seq_num,
        }
    }
}

#[event]
pub struct SwapEvent {
    pub common: CommonFields,
    pub input_amount: u64,
    pub output_amount: u64,
    pub swap_type: SwapType,
}

#[event]
pub struct AddLiquidityEvent {
    pub common: CommonFields,
    pub quote_amount: u64,
    pub max_base_amount: u64,
    pub min_lp_tokens: u64,
    pub base_amount: u64,
    pub lp_tokens_minted: u64,
}

#[event]
pub struct RemoveLiquidityEvent {
    pub common: CommonFields,
    pub lp_tokens_burned: u64,
    pub min_quote_amount: u64,
    pub min_base_amount: u64,
    pub base_amount: u64,
    pub quote_amount: u64,
}

#[event]
pub struct CreateAmmEvent {
    pub common: CommonFields,
    pub twap_initial_observation: u128,
    pub twap_max_observation_change_per_update: u128,
    pub lp_mint: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub vault_ata_base: Pubkey,
    pub vault_ata_quote: Pubkey,
}

#[event]
pub struct CrankThatTwapEvent {
    pub common: CommonFields,
}
