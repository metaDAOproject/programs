use anchor_lang::prelude::*;

#[error_code]
pub enum SharedLiquidityManagerError {
    #[msg("Insufficient stake amount")]
    InsufficientStake,
    #[msg("Proposal is not finalized")]
    ProposalNotFinalized,
    #[msg("No LP tokens to remove from AMM")]
    NoLpTokensToRemove,
    #[msg("No tokens received from AMM removal")]
    NoTokensFromAmm,
    #[msg("Insufficient reserves returned to spot AMM (less than 99.5%)")]
    InsufficientReservesReturned,
    #[msg("Pool is currently being used by an active proposal")]
    PoolInUse,
    #[msg("User does not have enough LP shares to withdraw")]
    InsufficientLpShares,
    #[msg("Slippage exceeded minimum token amounts")]
    SlippageExceeded,
    #[msg("No LP tokens in pool's LP token account")]
    NoLpTokensInPool,
    #[msg("Not enough LP tokens to provide liquidity to proposal")]
    NotEnoughLpTokens,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("No active proposal")]
    NoActiveProposal,
}


// 1 PLTR = 100 USDC
// We put 1 PLTR in, & 100 USDC in
// I get 100 PLTR-DOWN and you get 100 PLTR-UP.
// If PLTR goes to 10 USDC, I get 90 USDC