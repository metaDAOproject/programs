use anchor_lang::prelude::*;

#[error_code]
pub enum GatedTokenError {
    #[msg("Unauthorized: signer is not the gated mint admin")]
    UnauthorizedAdmin,
    #[msg("Unauthorized: signer is not the current freeze authority of the mint")]
    UnauthorizedFreezeAuthority,
    #[msg("Mint mismatch: account does not match the expected gated mint")]
    MintMismatch,
    #[msg("Gating is already disabled for this mint")]
    GatingDisabled,
    #[msg("Gating must be disabled to call this instruction")]
    GatingNotDisabled,
    #[msg("Target program is not on the gated_token whitelist")]
    TargetProgramNotWhitelisted,
    #[msg("Target program may not be the gated_token program itself")]
    SelfInvocation,
    #[msg("Invalid token account: account is not a valid SPL Token account of the gated mint")]
    InvalidTokenAccount,
}
