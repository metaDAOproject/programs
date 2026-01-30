use anchor_lang::prelude::*;

#[error_code]
pub enum PerformancePackageError {
    // Authorization
    #[msg("Signer is neither authority nor recipient")]
    Unauthorized,
    #[msg("Executor is not the opposite party from proposer")]
    InvalidExecutor,
    #[msg("Signer is not the current authority")]
    InvalidAuthority,

    // Account validation
    #[msg("Mint governor does not match the provided mint")]
    InvalidMintGovernor,
    #[msg("Mint authority does not match expected configuration")]
    InvalidMintAuthority,

    // State
    #[msg("Expected Locked status")]
    NotLocked,
    #[msg("Expected Unlocking status")]
    NotUnlocking,

    // Oracle
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

    // Time
    #[msg("Minimum unlock timestamp not yet reached")]
    UnlockTimestampNotReached,

    // Rewards
    #[msg("Math overflow in reward function")]
    RewardCalculationOverflow,

    // Configuration
    #[msg("Tranches not sorted or empty")]
    InvalidTranches,
    #[msg("Invalid vesting schedule configuration")]
    InvalidVestingSchedule,

    // Change Requests
    #[msg("Missing proposal for execute")]
    ChangeRequestNotFound,
    #[msg("All optional change fields are None")]
    NoChangesProposed,
}
