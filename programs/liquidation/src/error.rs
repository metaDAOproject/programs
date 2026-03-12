use super::*;

#[error_code]
pub enum LiquidationError {
    #[msg("Refunding is not enabled")]
    RefundingNotEnabled,
    #[msg("Liquidation is already activated")]
    AlreadyActivated,
    #[msg("No quote tokens to fund")]
    NothingToFund,
    #[msg("No base tokens assigned")]
    NoBaseAssigned,
    #[msg("Refund window has expired")]
    RefundWindowExpired,
    #[msg("Refund window has not expired")]
    RefundWindowNotExpired,
    #[msg("Duration must be greater than zero")]
    InvalidDuration,
    #[msg("Nothing to refund")]
    NothingToRefund,
    #[msg("Invalid allocation")]
    InvalidAllocation,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Invalid mint")]
    InvalidMint,
}
