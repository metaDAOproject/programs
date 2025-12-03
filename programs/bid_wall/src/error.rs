use super::*;

#[error_code]
pub enum BidWallError {
    #[msg("Bid wall expired")]
    BidWallExpired,
    #[msg("Bid wall not expired")]
    BidWallNotExpired,
    #[msg("Fee recipient mismatch")]
    FeeRecipientMismatch,
}
