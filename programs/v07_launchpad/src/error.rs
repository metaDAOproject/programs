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
    #[msg("Monthly spending limit must be less than 1/6th of the minimum raise amount and cannot be 0")]
    InvalidMonthlySpendingLimit,
    #[msg("There can only be at most 10 monthly spending limit members")]
    InvalidMonthlySpendingLimitMembers,
    #[msg("Cannot do more than a 50% premine, minimum is 10 atoms of token")]
    InvalidPriceBasedPremineAmount,
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
    #[msg("An invariant was violated. You should get in contact with the MetaDAO team if you see this")]
    InvariantViolated,
    #[msg("Launch must be live to be closed")]
    LaunchNotLive,
    #[msg("Minimum raise amount must be greater than or equal to $0.5 so that there's enough liquidity for the launch")]
    InvalidMinimumRaiseAmount,
    #[msg("The final raise amount has already been set")]
    FinalRaiseAmountAlreadySet,
    #[msg("Total approved amount must be greater than or equal to the minimum raise amount")]
    TotalApprovedAmountTooLow,
    #[msg("Invalid additional tokens recipient - should be set if additional tokens amount is greater than 0")]
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
}
