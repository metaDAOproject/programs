use super::*;

#[error_code]
pub enum BidWallError {
    #[msg("Bid wall not expired")]
    BidWallNotExpired,
    #[msg("Meteora DAMM pool discriminator mismatch")]
    MeteoraDammPoolDiscriminatorMismatch,
    #[msg("Meteora DAMM position discriminator mismatch")]
    MeteoraDammPositionDiscriminatorMismatch,
    #[msg("Meteora DAMM pool owner mismatch")]
    MeteoraDammPoolOwnerMismatch,
    #[msg("Meteora DAMM position owner mismatch")]
    MeteoraDammPositionOwnerMismatch,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Type cast failed")]
    TypeCastFailed,
    #[msg("Meteora DAMM position pool mismatch")]
    MeteoraDammPositionPoolMismatch,
}
