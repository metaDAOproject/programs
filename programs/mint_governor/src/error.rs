use super::*;

#[error_code]
pub enum MintGovernorError {
    #[msg("Unauthorized: signer is not the admin")]
    UnauthorizedAdmin,

    #[msg("Unauthorized: signer is not the authorized minter")]
    UnauthorizedMinter,

    #[msg("Mint mismatch: mint_governor.mint does not match provided mint")]
    MintMismatch,

    #[msg("Mint limit exceeded: would exceed max_total")]
    MintLimitExceeded,
}
