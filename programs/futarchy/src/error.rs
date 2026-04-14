use super::*;

#[error_code]
pub enum FutarchyError {
    #[msg("Amms must have been created within 5 minutes (counted in slots) of proposal initialization")]
    AmmTooOld,
    #[msg("An amm has an `initial_observation` that doesn't match the `dao`'s config")]
    InvalidInitialObservation,
    #[msg(
        "An amm has a `max_observation_change_per_update` that doesn't match the `dao`'s config"
    )]
    InvalidMaxObservationChange,
    #[msg("An amm has a `start_delay_slots` that doesn't match the `dao`'s config")]
    InvalidStartDelaySlots,
    #[msg("One of the vaults has an invalid `settlement_authority`")]
    InvalidSettlementAuthority,
    #[msg("Proposal is too young to be executed or rejected")]
    ProposalTooYoung,
    #[msg("Markets too young for proposal to be finalized. TWAP might need to be cranked")]
    MarketsTooYoung,
    #[msg("This proposal has already been finalized")]
    ProposalAlreadyFinalized,
    #[msg("A conditional vault has an invalid nonce. A nonce should encode the proposal number")]
    InvalidVaultNonce,
    #[msg("This proposal can't be executed because it isn't in the passed state")]
    ProposalNotPassed,
    #[msg("More liquidity needs to be in the AMM to launch this proposal")]
    InsufficientLiquidity,
    #[msg("Proposal duration must be longer 1 day and longer than 2 times the TWAP start delay")]
    ProposalDurationTooShort,
    #[msg("Pass threshold must be less than 10%")]
    PassThresholdTooHigh,
    #[msg("Question must have exactly 2 outcomes for binary futarchy")]
    QuestionMustBeBinary,
    #[msg("Squads proposal must be in Active status")]
    InvalidSquadsProposalStatus,
    #[msg("Casting overflow. If you're seeing this, please report this")]
    CastingOverflow,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Cannot remove zero liquidity")]
    ZeroLiquidityRemove,
    #[msg("Swap slippage exceeded")]
    SwapSlippageExceeded,
    #[msg("Assert failed")]
    AssertFailed,
    #[msg("Invalid admin")]
    InvalidAdmin,
    #[msg("Proposal is not in draft state")]
    ProposalNotInDraftState,
    #[msg("Insufficient token balance")]
    InsufficientTokenBalance,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Insufficient stake to launch proposal")]
    InsufficientStakeToLaunch,
    #[msg("Staker not found in proposal")]
    StakerNotFound,
    #[msg("Pool must be in spot state")]
    PoolNotInSpotState,
    #[msg("If you're providing liquidity, you must provide both base and quote token accounts")]
    InvalidDaoCreateLiquidity,
    #[msg("Invalid stake account")]
    InvalidStakeAccount,
    #[msg("An invariant was violated. You should get in contact with the MetaDAO team if you see this")]
    InvariantViolated,
    #[msg("Proposal needs to be active to perform a conditional swap")]
    ProposalNotActive,
    #[msg("This Squads transaction should only contain calls to update spending limits")]
    InvalidTransaction,
    #[msg("Proposal has already been sponsored")]
    ProposalAlreadySponsored,
    #[msg("Team sponsored pass threshold must be between -10% and 10%")]
    InvalidTeamSponsoredPassThreshold,
    #[msg("Target K must be greater than the current K")]
    InvalidTargetK,
    #[msg("Failed to compile transaction message for Squads vault transaction")]
    InvalidTransactionMessage,
    #[msg("Base mint and quote mint must be different")]
    InvalidMint,
    #[msg("Proposal is not ready to be unstaked")]
    ProposalNotReadyToUnstake,
}
