use anchor_lang::prelude::*;

#[error_code]
pub enum PerformancePackageError {
    #[msg("Signer is neither authority nor recipient")]
    Unauthorized,
    #[msg("Executor is not the opposite party from proposer")]
    InvalidExecutor,
    #[msg("Signer is not the current authority")]
    InvalidAuthority,
    #[msg("Signer is not the admin")]
    InvalidAdmin,
    #[msg("Mint governor does not match the provided mint")]
    InvalidMintGovernor,
    #[msg("Mint authority does not match expected configuration")]
    InvalidMintAuthority,
    #[msg("Expected Locked status")]
    NotLocked,
    #[msg("Expected Unlocking status")]
    NotUnlocking,
    #[msg("Expected remaining_accounts not provided")]
    OracleMissingAccount,
    #[msg("Account pubkey doesn't match expected")]
    OracleInvalidAccount,
    #[msg("Failed to parse account data")]
    OracleParseError,
    #[msg("Oracle state invalid")]
    OracleInvalidState,
    #[msg("Minimum duration hasn't passed yet")]
    OracleMinDurationNotReached,
    #[msg("Minimum unlock timestamp not yet reached")]
    UnlockTimestampNotReached,
    #[msg("Math overflow in reward function")]
    RewardCalculationOverflow,
    #[msg("Tranches should be sorted and non-empty")]
    InvalidTranches,
    #[msg("Invalid vesting schedule configuration")]
    InvalidVestingSchedule,
    #[msg("Missing proposal for execute")]
    ChangeRequestNotFound,
    #[msg("All optional change fields are None")]
    NoChangesProposed,
    #[msg("min_duration exceeds maximum allowed (365 days)")]
    MinDurationTooLarge,
}
