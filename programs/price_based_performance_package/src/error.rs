use anchor_lang::prelude::*;

#[error_code]
pub enum PriceBasedPerformancePackageError {
    #[msg("Unlock timestamp has not been reached yet")]
    UnlockTimestampNotReached,
    #[msg("Unlock timestamp must be in the future")]
    UnlockTimestampInThePast,
    #[msg("Performance package is not in the expected state")]
    InvalidPerformancePackageState,
    #[msg("TWAP calculation failed")]
    TwapPeriodNotElapsed,
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
    #[msg("Tranche price thresholds must be monotonically increasing")]
    TranchePriceThresholdsNotMonotonic,
    #[msg("Tranche token amount must be greater than 0")]
    TrancheTokenAmountZero,
    #[msg("TWAP length must be greater than or equal to 1 day and less than 1 year")]
    InvalidTwapLength,
    #[msg("Invalid admin")]
    InvalidAdmin,
    #[msg("Total token amount calculation would overflow")]
    TotalTokenAmountOverflow,
    #[msg("Recipient and performance package authority must be different keys")]
    RecipientAuthorityMustDiffer,
    #[msg("Withdrawal limits must have non-zero caps, a future end, and a window of at least one second")]
    InvalidWithdrawalLimits,
    #[msg("Amount exceeds the withdrawable balance")]
    InsufficientWithdrawableBalance,
    #[msg("Token cap for the current window exceeded")]
    TokenWindowLimitExceeded,
    #[msg("Quote cap for the current window exceeded")]
    QuoteWindowLimitExceeded,
    #[msg("Oracle price observation is missing or zero")]
    InvalidPriceObservation,
    #[msg("Token withdrawals are disabled by the withdrawal mode")]
    WithdrawTokensDisabled,
    #[msg("Sell withdrawals are disabled by the withdrawal mode")]
    WithdrawViaSellDisabled,
    #[msg("Performance package has not been resized to the current layout")]
    AccountNotMigrated,
    #[msg("Quote mint must differ from the package's token mint")]
    InvalidQuoteMint,
    #[msg("The package's quote account and the quote destination must be passed together")]
    QuoteSweepAccountsIncomplete,
}
