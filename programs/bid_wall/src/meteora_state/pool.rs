use anchor_lang::prelude::*;

use static_assertions::const_assert_eq;

use super::NUM_REWARDS;
use crate::curve::{get_delta_amount_a_unsigned, get_delta_amount_b_unsigned};
use crate::error::BidWallError;
use crate::math::u128x128_math::Rounding;

#[zero_copy]
#[derive(InitSpace, Debug, Default)]
pub struct Pool {
    /// Pool fee
    pub pool_fees: PoolFeesStruct,
    /// token a mint
    pub token_a_mint: Pubkey,
    /// token b mint
    pub token_b_mint: Pubkey,
    /// token a vault
    pub token_a_vault: Pubkey,
    /// token b vault
    pub token_b_vault: Pubkey,
    /// Whitelisted vault to be able to buy pool before activation_point
    pub whitelisted_vault: Pubkey,
    /// partner
    pub partner: Pubkey,
    /// liquidity share
    pub liquidity: u128,
    /// padding, previous reserve amount, be careful to use that field
    pub _padding: u128,
    /// protocol a fee
    pub protocol_a_fee: u64,
    /// protocol b fee
    pub protocol_b_fee: u64,
    /// partner a fee
    pub partner_a_fee: u64,
    /// partner b fee
    pub partner_b_fee: u64,
    /// min price
    pub sqrt_min_price: u128,
    /// max price
    pub sqrt_max_price: u128,
    /// current price
    pub sqrt_price: u128,
    /// Activation point, can be slot or timestamp
    pub activation_point: u64,
    /// Activation type, 0 means by slot, 1 means by timestamp
    pub activation_type: u8,
    /// pool status, 0: enable, 1 disable
    pub pool_status: u8,
    /// token a flag
    pub token_a_flag: u8,
    /// token b flag
    pub token_b_flag: u8,
    /// 0 is collect fee in both token, 1 only collect fee in token a, 2 only collect fee in token b
    pub collect_fee_mode: u8,
    /// pool type
    pub pool_type: u8,
    /// pool version, 0: max_fee is still capped at 50%, 1: max_fee is capped at 99%
    pub version: u8,
    /// padding
    pub _padding_0: u8,
    /// cumulative
    pub fee_a_per_liquidity: [u8; 32], // U256
    /// cumulative
    pub fee_b_per_liquidity: [u8; 32], // U256
    // TODO: Is this large enough?
    pub permanent_lock_liquidity: u128,
    /// metrics
    pub metrics: PoolMetrics,
    /// pool creator
    pub creator: Pubkey,
    /// Padding for further use
    pub _padding_1: [u64; 6],
    /// Farming reward information
    pub reward_infos: [RewardInfo; NUM_REWARDS],
}

const_assert_eq!(Pool::INIT_SPACE, 1104);

#[zero_copy]
#[derive(Debug, InitSpace, Default)]
pub struct PoolMetrics {
    pub total_lp_a_fee: u128,
    pub total_lp_b_fee: u128,
    pub total_protocol_a_fee: u64,
    pub total_protocol_b_fee: u64,
    pub total_partner_a_fee: u64,
    pub total_partner_b_fee: u64,
    pub total_position: u64,
    pub padding: u64,
}

const_assert_eq!(PoolMetrics::INIT_SPACE, 80);

/// Stores the state relevant for tracking liquidity mining rewards
#[zero_copy]
#[derive(InitSpace, Default, Debug, PartialEq)]
pub struct RewardInfo {
    /// Indicates if the reward has been initialized
    pub initialized: u8,
    /// reward token flag
    pub reward_token_flag: u8,
    /// padding
    pub _padding_0: [u8; 6],
    /// Padding to ensure `reward_rate: u128` is 16-byte aligned
    pub _padding_1: [u8; 8], // 8 bytes
    /// Reward token mint.
    pub mint: Pubkey,
    /// Reward vault token account.
    pub vault: Pubkey,
    /// Authority account that allows to fund rewards
    pub funder: Pubkey,
    /// reward duration
    pub reward_duration: u64,
    /// reward duration end
    pub reward_duration_end: u64,
    /// reward rate
    pub reward_rate: u128,
    /// Reward per token stored
    pub reward_per_token_stored: [u8; 32], // U256
    /// The last time reward states were updated.
    pub last_update_time: u64,
    /// Accumulated seconds when the farm distributed rewards but the bin was empty.
    /// These rewards will be carried over to the next reward time window.
    pub cumulative_seconds_with_empty_liquidity_reward: u64,
}

const_assert_eq!(RewardInfo::INIT_SPACE, 192);

#[zero_copy]
#[derive(Debug, InitSpace, Default)]
pub struct PoolFeesStruct {
    /// Trade fees are extra token amounts that are held inside the token
    /// accounts during a trade, making the value of liquidity tokens rise.
    /// Trade fee numerator
    pub base_fee: BaseFeeStruct,

    /// Protocol trading fees are extra token amounts that are held inside the token
    /// accounts during a trade, with the equivalent in pool tokens minted to
    /// the protocol of the program.
    /// Protocol trade fee numerator
    pub protocol_fee_percent: u8,
    /// partner fee
    pub partner_fee_percent: u8,
    /// referral fee
    pub referral_fee_percent: u8,
    /// padding
    pub padding_0: [u8; 5],

    /// dynamic fee
    pub dynamic_fee: DynamicFeeStruct,

    /// padding
    pub padding_1: [u64; 2],
}

const_assert_eq!(PoolFeesStruct::INIT_SPACE, 160);

#[zero_copy]
#[derive(Debug, InitSpace, Default)]
pub struct BaseFeeStruct {
    pub cliff_fee_numerator: u64,
    // In fee scheduler first_factor: number_of_period, second_factor: period_frequency, third_factor: reduction_factor
    // in rate limiter: first_factor: fee_increment_bps, second_factor: max_limiter_duration, max_fee_bps, third_factor: reference_amount
    pub base_fee_mode: u8,
    pub padding_0: [u8; 5],
    pub first_factor: u16,
    pub second_factor: [u8; 8],
    pub third_factor: u64,
    pub padding_1: u64,
}

const_assert_eq!(BaseFeeStruct::INIT_SPACE, 40);

#[zero_copy]
#[derive(Debug, InitSpace, Default)]
pub struct DynamicFeeStruct {
    pub initialized: u8, // 0, ignore for dynamic fee
    pub padding: [u8; 7],
    pub max_volatility_accumulator: u32,
    pub variable_fee_control: u32,
    pub bin_step: u16,
    pub filter_period: u16,
    pub decay_period: u16,
    pub reduction_factor: u16,
    pub last_update_timestamp: u64,
    pub bin_step_u128: u128,
    pub sqrt_price_reference: u128, // reference sqrt price
    pub volatility_accumulator: u128,
    pub volatility_reference: u128, // decayed volatility accumulator
}

const_assert_eq!(DynamicFeeStruct::INIT_SPACE, 96);

#[derive(Debug, PartialEq)]
pub struct ModifyLiquidityResult {
    pub token_a_amount: u64,
    pub token_b_amount: u64,
}

impl Pool {
    pub fn get_amounts_for_modify_liquidity(
        &self,
        liquidity_delta: u128,
        round: Rounding,
    ) -> Result<ModifyLiquidityResult> {
        // finding output amount
        let token_a_amount = get_delta_amount_a_unsigned(
            self.sqrt_price,
            self.sqrt_max_price,
            liquidity_delta,
            round,
        )?;

        let token_b_amount = get_delta_amount_b_unsigned(
            self.sqrt_min_price,
            self.sqrt_price,
            liquidity_delta,
            round,
        )?;

        Ok(ModifyLiquidityResult {
            token_a_amount,
            token_b_amount,
        })
    }

    pub const fn discriminator() -> [u8; 8] {
        [241, 154, 109, 4, 17, 177, 109, 188]
    }

    pub fn validate_discriminator(discriminator: &[u8]) -> Result<()> {
        if discriminator != &Self::discriminator() {
            return Err(BidWallError::MeteoraDammPoolDiscriminatorMismatch.into());
        }
        Ok(())
    }
}
