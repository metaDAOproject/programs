pub fn mul_div_ceil(a: u64, b: u64, divisor: u64) -> u64 {
    let numerator = (a as u128).checked_mul(b as u128).unwrap();

    let result = numerator.checked_div(divisor as u128).unwrap() as u64;

    if numerator.checked_rem(divisor as u128).unwrap() != 0 {
        result + 1
    } else {
        result
    }
}
