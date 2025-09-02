use anchor_lang::prelude::*;

#[error_code]
pub enum PriceBasedUnlockError {
    #[msg("Unlock timestamp has not been reached yet")]
    UnlockTimestampNotReached,
    #[msg("Locker is not in the expected state")]
    InvalidLockerState,
    #[msg("TWAP calculation failed")]
    TwapCalculationFailed,
    #[msg("Price threshold not met")]
    PriceThresholdNotMet,
    #[msg("Invalid oracle account data")]
    InvalidOracleData,
}
