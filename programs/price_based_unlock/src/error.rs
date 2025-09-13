use anchor_lang::prelude::*;

#[error_code]
pub enum PriceBasedUnlockError {
    #[msg("Unlock timestamp has not been reached yet")]
    UnlockTimestampNotReached,
    #[msg("Unlock timestamp must be in the future")]
    UnlockTimestampInThePast,
    #[msg("Locker is not in the expected state")]
    InvalidLockerState,
    #[msg("TWAP calculation failed")]
    TwapCalculationFailed,
    #[msg("Price threshold not met")]
    PriceThresholdNotMet,
    #[msg("Invalid oracle account data")]
    InvalidOracleData,
    #[msg("Unauthorized to create or execute change request")]
    UnauthorizedChangeRequest,
    #[msg("Change request does not match locker")]
    InvalidChangeRequest,
    #[msg("Unauthorized locker authority")]
    UnauthorizedLockerAuthority,
    #[msg("An invariant was violated. You should get in contact with the MetaDAO team if you see this")]
    InvariantViolated,
}
