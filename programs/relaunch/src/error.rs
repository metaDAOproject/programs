use anchor_lang::prelude::*;

#[error_code]
pub enum RelaunchError {
    #[msg("New mint supply must be zero")]
    SupplyNonZero,
    #[msg("New mint must not have a freeze authority")]
    FreezeAuthoritySet,
    #[msg("Source pool is not the canonical PumpSwap pool for the old mint")]
    SourcePoolNotCanonical,
    #[msg("Source quote mint does not match the source pool's quote mint")]
    SourcePoolQuoteMintMismatch,
    #[msg("Source quote mint must be WSOL or USDC")]
    InvalidQuoteMint,
    #[msg("Old mint carries a Token-2022 extension outside the metadata allowlist")]
    ForbiddenOldMintExtension,
    #[msg("Threshold must be between 1 and 10000 bps")]
    InvalidThresholdBps,
    #[msg("Deposit period must be at most 1 year")]
    InvalidSecondsForDeposits,
    #[msg("Monthly spending limit amount and members must both be set or both be empty")]
    InvalidMonthlySpendingLimit,
    #[msg("There can be at most 10 monthly spending limit members, without duplicates")]
    InvalidMonthlySpendingLimitMembers,
}
