// Code lifted from https://github.com/MeteoraAg/damm-v2/blob/main/programs/cp-amm/src/math/safe_math.rs, with some modifications
use ruint::aliases::U256;

use crate::error::BidWallError;

pub trait SafeMath<T>: Sized {
    fn safe_add(self, rhs: Self) -> Result<Self, BidWallError>;
    fn safe_mul(self, rhs: Self) -> Result<Self, BidWallError>;
    fn safe_div(self, rhs: Self) -> Result<Self, BidWallError>;
    fn safe_rem(self, rhs: Self) -> Result<Self, BidWallError>;
    fn safe_sub(self, rhs: Self) -> Result<Self, BidWallError>;
    fn safe_shl(self, offset: T) -> Result<Self, BidWallError>;
    fn safe_shr(self, offset: T) -> Result<Self, BidWallError>;
}

macro_rules! checked_impl {
    ($t:ty, $offset:ty) => {
        impl SafeMath<$offset> for $t {
            #[inline(always)]
            fn safe_add(self, v: $t) -> Result<$t, BidWallError> {
                match self.checked_add(v) {
                    Some(result) => Ok(result),
                    None => Err(BidWallError::MathOverflow),
                }
            }

            #[inline(always)]
            fn safe_sub(self, v: $t) -> Result<$t, BidWallError> {
                match self.checked_sub(v) {
                    Some(result) => Ok(result),
                    None => Err(BidWallError::MathOverflow),
                }
            }

            #[inline(always)]
            fn safe_mul(self, v: $t) -> Result<$t, BidWallError> {
                match self.checked_mul(v) {
                    Some(result) => Ok(result),
                    None => Err(BidWallError::MathOverflow),
                }
            }

            #[inline(always)]
            fn safe_div(self, v: $t) -> Result<$t, BidWallError> {
                match self.checked_div(v) {
                    Some(result) => Ok(result),
                    None => Err(BidWallError::MathOverflow),
                }
            }

            #[inline(always)]
            fn safe_rem(self, v: $t) -> Result<$t, BidWallError> {
                match self.checked_rem(v) {
                    Some(result) => Ok(result),
                    None => Err(BidWallError::MathOverflow),
                }
            }

            #[inline(always)]
            fn safe_shl(self, v: $offset) -> Result<$t, BidWallError> {
                match self.checked_shl(v) {
                    Some(result) => Ok(result),
                    None => Err(BidWallError::MathOverflow),
                }
            }

            #[inline(always)]
            fn safe_shr(self, v: $offset) -> Result<$t, BidWallError> {
                match self.checked_shr(v) {
                    Some(result) => Ok(result),
                    None => Err(BidWallError::MathOverflow),
                }
            }
        }
    };
}

checked_impl!(u128, u32);
checked_impl!(U256, usize);
