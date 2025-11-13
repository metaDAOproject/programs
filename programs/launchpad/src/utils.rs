use crate::DEFAULT_FUNDING_FEE_BPS;

/// Calculates the funding fee and net amount after applying the fee.
///
/// Returns a tuple of `(amount_after_fees, total_fees)` where the fee is calculated
/// as a percentage of the input amount based on `DEFAULT_FUNDING_FEE_BPS` (basis points).
/// The fee is rounded down using checked division.
pub fn apply_funding_fee(amount: u64) -> (u64, u64) {
    let numerator = (amount as u128)
        .checked_mul(DEFAULT_FUNDING_FEE_BPS as u128)
        .unwrap();

    let total_fees = numerator.checked_div(10_000_u128).unwrap() as u64;

    let total_fees = if numerator.checked_rem(10_000_u128).unwrap() != 0 {
        total_fees + 1
    } else {
        total_fees
    };

    let amount_after_fees = amount.checked_sub(total_fees).unwrap();

    (amount_after_fees, total_fees)
}

pub fn apply_funding_fee_inverse(amount: u64) -> (u64, u64) {
    let numerator = (amount as u128).checked_mul(10_000_u128).unwrap();

    let divisor = 10_000_u128
        .checked_sub(DEFAULT_FUNDING_FEE_BPS as u128)
        .unwrap();

    let amount_after_fees = numerator.checked_div(divisor).unwrap() as u64;

    let amount_after_fees = if numerator.checked_rem(divisor).unwrap() != 0 {
        amount_after_fees + 1
    } else {
        amount_after_fees
    };

    let total_fees = amount_after_fees.checked_sub(amount).unwrap();

    (amount_after_fees, total_fees)
}
