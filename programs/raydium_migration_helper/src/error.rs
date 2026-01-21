use anchor_lang::prelude::*;

#[error_code]
pub enum RaydiumMigrationError {
    #[msg("Insufficient LP token balance")]
    InsufficientLpBalance,

    #[msg("Token account owner mismatch")]
    TokenAccountOwnerMismatch,

    #[msg("Invalid token mint")]
    InvalidTokenMint,

    #[msg("Math overflow error")]
    MathOverflow,

    #[msg("Base and quote mints must be different")]
    DuplicateTokenMints,
}
