use anchor_lang::prelude::*;

#[error_code]
pub enum LaunchpadError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Supply must be zero")]
    SupplyNonZero,
    #[msg("Launch period must be between 1 hour and 2 weeks")]
    InvalidSecondsForLaunch,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Invalid launch state")]
    InvalidLaunchState,
    #[msg("Launch period not over")]
    LaunchPeriodNotOver,
    #[msg("Launch is complete, no more funding allowed")]
    LaunchExpired,
    #[msg("Refund not available")]
    LaunchNotRefunding,
    #[msg("Launch must be initialized to be started")]
    LaunchNotInitialized,
    #[msg("Freeze authority can't be set on launchpad tokens")]
    FreezeAuthoritySet,
    #[msg("Monthly spending limit must be less than 1/6th of the minimum raise amount and cannot be 0")]
    InvalidMonthlySpendingLimit,
    #[msg("There can only be at most 10 monthly spending limit members")]
    InvalidMonthlySpendingLimitMembers,
    #[msg("Invalid performance package token amount")]
    InvalidPerformancePackageTokenAmount,
    #[msg("Insiders must wait at least 12 months before unlocking")]
    InvalidPerformancePackageMinUnlockTime,
    #[msg("Launch authority must be set to complete the launch until 2 days after closing")]
    LaunchAuthorityNotSet,
    #[msg("The final amount raised must be >= the minimum raise amount")]
    FinalRaiseAmountTooLow,
    #[msg("Tokens already claimed")]
    TokensAlreadyClaimed,
    #[msg("USDC already refunded")]
    MoneyAlreadyRefunded,
    #[msg("Invariant violated")]
    InvariantViolated,
    #[msg("Launch must be live to be closed")]
    LaunchNotLive,
    #[msg("Minimum raise amount too low for liquidity")]
    InvalidMinimumRaiseAmount,
    #[msg("Final raise amount already set")]
    FinalRaiseAmountAlreadySet,
    #[msg("Total approved amount too low")]
    TotalApprovedAmountTooLow,
    #[msg("Additional tokens recipient must be set when amount > 0")]
    InvalidAdditionalTokensRecipient,
    #[msg("No additional tokens recipient set")]
    NoAdditionalTokensRecipientSet,
    #[msg("Additional tokens already claimed")]
    AdditionalTokensAlreadyClaimed,
    #[msg("Funding record approval period is over")]
    FundingRecordApprovalPeriodOver,
    #[msg("Performance package already initialized")]
    PerformancePackageAlreadyInitialized,
    #[msg("Invalid DAO")]
    InvalidDao,
    #[msg("Accumulator activation delay must be less than the launch duration")]
    InvalidAccumulatorActivationDelaySeconds,
    #[msg("Extend duration would exceed maximum allowed launch duration")]
    ExtendDurationExceedsMax,
    #[msg("Mint authority does not match expected")]
    InvalidMintAuthority,
    #[msg("Invalid Meteora account")]
    InvalidMeteoraAccount,
}
