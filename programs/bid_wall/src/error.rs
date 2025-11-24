use super::*;

#[error_code]
pub enum BidWallError {
    #[msg("Bid wall not expired")]
    BidWallNotExpired,
}
