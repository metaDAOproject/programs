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
    #[msg("Token mint key must end in 'meta'")]
    InvalidTokenKey,
    #[msg("Invalid launch state")]
    InvalidLaunchState,
    #[msg("Launch period not over")]
    LaunchPeriodNotOver,
    #[msg("Launch is complete, no more funding allowed")]
    LaunchExpired,
    #[msg("For you to get a refund, either the launch needs to be in a refunding state or the launch must have been over-committed")]
    LaunchNotRefunding,
    #[msg("Launch must be initialized to be started")]
    LaunchNotInitialized,
    #[msg("Freeze authority can't be set on launchpad tokens")]
    FreezeAuthoritySet,
    #[msg("Monthly spending limit must be less than 1/6th of the minimum raise amount")]
    InvalidMonthlySpendingLimit,
    #[msg("Cannot do more than a 50% premine")]
    InvalidPriceBasedPremineAmount,
    #[msg("Price-based unlock threshold must be at least 2x the minimum launch price")]
    InvalidPriceBasedUnlockThreshold,
    #[msg("Insiders must be forced to wait at least 18 months before unlocking their tokens")]
    InvalidPerformancePackageMinUnlockTime,
    #[msg("Launch authority must be set to complete the launch until 2 days after closing")]
    LaunchAuthorityNotSet,
    #[msg("The final amount raised must be greater than or equal to the minimum raise amount")]
    FinalRaiseAmountTooLow,
    #[msg("Tokens already claimed")]
    TokensAlreadyClaimed,
    #[msg("Money already refunded")]
    MoneyAlreadyRefunded,
}
