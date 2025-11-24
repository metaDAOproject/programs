use ruint::aliases::{U256, U512};

/// Round up, down
#[derive(PartialEq, Clone, Copy)]
pub enum Rounding {
    /// Rounding up
    Up,
    /// Rounding down
    Down,
}

/// (x * y) / denominator
// pub fn mul_div(x: u128, y: u128, denominator: u128, rounding: Rounding) -> Option<u128> {
//     if denominator == 0 {
//         return None;
//     }

//     let x = U256::from(x);
//     let y = U256::from(y);
//     let denominator = U256::from(denominator);

//     let prod = x.checked_mul(y)?;

//     match rounding {
//         Rounding::Up => prod.div_ceil(denominator).try_into().ok(),
//         Rounding::Down => {
//             let (quotient, _) = prod.div_rem(denominator);
//             quotient.try_into().ok()
//         }
//     }
// }

/// (x * y) >> offset
/// roundown
#[inline]
pub fn mul_shr(x: u128, y: u128, offset: u8) -> Option<u128> {
    let x = U256::from(x);
    let y = U256::from(y);
    let prod = x.checked_mul(y)?;
    let (quotient, _is_overflow) = prod.overflowing_shr(offset.into());
    quotient.try_into().ok()
}

#[inline]
pub fn mul_shr_256(x: U256, y: U256, offset: u8) -> Option<u128> {
    let x = U512::from(x);
    let y = U512::from(y);
    let prod = x.checked_mul(y)?;
    let (quotient, _is_overflow) = prod.overflowing_shr(offset.into());
    quotient.try_into().ok()
}

/// (x << offset) / y
#[inline]
pub fn shl_div(x: u128, y: u128, offset: u8, rounding: Rounding) -> Option<u128> {
    if y == 0 {
        return None;
    }
    let denominator = U256::from(y);
    let prod = U256::from(x).checked_shl(offset as usize)?;
    match rounding {
        Rounding::Up => prod.div_ceil(denominator).try_into().ok(),
        Rounding::Down => {
            let (quotient, _) = prod.div_rem(denominator);
            quotient.try_into().ok()
        }
    }
}

/// (x << offset) / y
#[inline]
pub fn shl_div_256(x: u128, y: u128, offset: u8) -> Option<U256> {
    if y == 0 {
        return None;
    }
    let denominator = U256::from(y);
    let prod = U256::from(x).checked_shl(offset as usize)?;

    prod.checked_div(denominator)
}

/// (x * y) / denominator
pub fn mul_div_u256(x: U256, y: U256, denominator: U256, rounding: Rounding) -> Option<U256> {
    if denominator == U256::ZERO {
        return None;
    }

    let x = U512::from(x);
    let y = U512::from(y);
    let denominator = U512::from(denominator);

    let prod = x.checked_mul(y)?;

    let result = match rounding {
        Rounding::Up => prod.div_ceil(denominator),
        Rounding::Down => {
            let (quotient, _) = prod.div_rem(denominator);
            quotient
        }
    };
    if result > U512::from(U256::MAX) {
        None
    } else {
        Some(U256::from(result))
    }
}
