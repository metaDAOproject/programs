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
