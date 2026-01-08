use super::*;

#[error_code]
pub enum BidWallError {
    #[msg("Bid wall expired")]
    BidWallExpired,
    #[msg("Bid wall not expired")]
    BidWallNotExpired,
    #[msg("Fee recipient mismatch")]
    FeeRecipientMismatch,
    #[msg("Insufficient quote reserves")]
    InsufficientQuoteReserves,
    #[msg("Bid wall depleted")]
    BidWallDepleted,
    #[msg("Invalid input amount")]
    InvalidInputAmount,
    #[msg("Invalid admin")]
    InvalidAdmin,
}
