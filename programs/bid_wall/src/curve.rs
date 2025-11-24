use anchor_lang::prelude::*;
use ruint::aliases::U256;

use crate::{
    error::BidWallError,
    math::{
        safe_math::SafeMath,
        u128x128_math::{mul_div_u256, Rounding},
    },
};

pub const RESOLUTION: u8 = 64;

/// Gets the delta amount_a for given liquidity and price range
///
/// # Formula
///
/// * `Δa = L * (1 / √P_lower - 1 / √P_upper)`
/// * i.e. `L * (√P_upper - √P_lower) / (√P_upper * √P_lower)`
pub fn get_delta_amount_a_unsigned(
    lower_sqrt_price: u128,
    upper_sqrt_price: u128,
    liquidity: u128,
    round: Rounding,
) -> Result<u64> {
    let result = get_delta_amount_a_unsigned_unchecked(
        lower_sqrt_price,
        upper_sqrt_price,
        liquidity,
        round,
    )?;
    require!(result <= U256::from(u64::MAX), BidWallError::MathOverflow);
    return Ok(result
        .try_into()
        .map_err(|_| BidWallError::TypeCastFailed)?);
}

/// * i.e. `L * (√P_upper - √P_lower) / (√P_upper * √P_lower)`
pub fn get_delta_amount_a_unsigned_unchecked(
    lower_sqrt_price: u128,
    upper_sqrt_price: u128,
    liquidity: u128,
    round: Rounding,
) -> Result<U256> {
    let numerator_1 = U256::from(liquidity);
    let numerator_2 = U256::from(upper_sqrt_price - lower_sqrt_price);

    let denominator = U256::from(lower_sqrt_price).safe_mul(U256::from(upper_sqrt_price))?;

    assert!(denominator > U256::ZERO);
    let result = mul_div_u256(numerator_1, numerator_2, denominator, round)
        .ok_or_else(|| BidWallError::MathOverflow)?;
    return Ok(result);
}

/// Gets the delta amount_b for given liquidity and price range
/// Δb = L * (√P_upper - √P_lower)
pub fn get_delta_amount_b_unsigned(
    lower_sqrt_price: u128,
    upper_sqrt_price: u128,
    liquidity: u128,
    round: Rounding,
) -> Result<u64> {
    let result = get_delta_amount_b_unsigned_unchecked(
        lower_sqrt_price,
        upper_sqrt_price,
        liquidity,
        round,
    )?;
    require!(result <= U256::from(u64::MAX), BidWallError::MathOverflow);
    return Ok(result
        .try_into()
        .map_err(|_| BidWallError::TypeCastFailed)?);
}

// Δb = L * (√P_upper - √P_lower)
pub fn get_delta_amount_b_unsigned_unchecked(
    lower_sqrt_price: u128,
    upper_sqrt_price: u128,
    liquidity: u128,
    round: Rounding,
) -> Result<U256> {
    let liquidity = U256::from(liquidity);
    let delta_sqrt_price = U256::from(upper_sqrt_price.safe_sub(lower_sqrt_price)?);
    let prod = liquidity.safe_mul(delta_sqrt_price)?;

    match round {
        Rounding::Up => {
            let denominator = U256::from(1).safe_shl((RESOLUTION as usize) * 2)?;
            let result = prod.div_ceil(denominator);
            Ok(result)
        }
        Rounding::Down => {
            let (result, _) = prod.overflowing_shr((RESOLUTION as usize) * 2);
            Ok(result)
        }
    }
}
