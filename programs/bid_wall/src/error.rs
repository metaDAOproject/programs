use super::*;

#[error_code]
pub enum BidWallError {
    #[msg("Bid wall not expired")]
    BidWallNotExpired,
    #[msg("Meteora DAMM pool discriminator mismatch")]
    MeteoraDammPoolDiscriminatorMismatch,
    #[msg("Meteora DAMM position discriminator mismatch")]
    MeteoraDammPositionDiscriminatorMismatch,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Type cast failed")]
    TypeCastFailed,
    #[msg("Meteora DAMM position pool mismatch")]
    MeteoraDammPositionPoolMismatch,
    #[msg("Meteora DAMM pool mints do not match the bid wall mints")]
    MeteoraDammPoolMintsMismatch,
}
