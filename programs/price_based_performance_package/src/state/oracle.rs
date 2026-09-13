use anchor_lang::error::ErrorCode;
use anchor_lang::prelude::*;
use futarchy::{Dao, Pool, PoolState};

use crate::{PriceBasedPerformancePackageError, PRICE_SCALE};

/// Read the oracle account as the futarchy `Dao` whose spot pool prices withdrawals.
pub fn read_dao(oracle: &AccountInfo) -> Result<Dao> {
    if oracle.owner != &Dao::owner() {
        return Err(Error::from(ErrorCode::AccountOwnedByWrongProgram)
            .with_pubkeys((*oracle.owner, Dao::owner())));
    }

    let data = oracle.try_borrow_data()?;
    Dao::try_deserialize(&mut &data[..])
}

/// The higher of the spot pool's damped observation and its reserve price.
pub fn valuation_price(dao: &Dao) -> Result<u128> {
    let pool: &Pool = match &dao.amm.state {
        PoolState::Spot { spot } | PoolState::Futarchy { spot, .. } => spot,
    };

    let observation = pool.oracle.last_observation;
    require_gt!(
        observation,
        0,
        PriceBasedPerformancePackageError::InvalidPriceObservation
    );

    let reserve_price = if pool.base_reserves == 0 {
        0
    } else {
        (pool.quote_reserves as u128 * PRICE_SCALE) / pool.base_reserves as u128
    };

    Ok(observation.max(reserve_price))
}

/// Value `amount` base atoms at `price`, in quote atoms, rounding up.
pub fn quote_value_at_price(amount: u64, price: u128) -> Result<u64> {
    let scaled = (amount as u128)
        .checked_mul(price)
        .ok_or(PriceBasedPerformancePackageError::QuoteWindowLimitExceeded)?;

    let value = scaled
        .checked_add(PRICE_SCALE - 1)
        .ok_or(PriceBasedPerformancePackageError::QuoteWindowLimitExceeded)?
        / PRICE_SCALE;

    u64::try_from(value)
        .map_err(|_| PriceBasedPerformancePackageError::QuoteWindowLimitExceeded.into())
}
