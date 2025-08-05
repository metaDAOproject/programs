use anchor_lang::prelude::*;

#[error_code]
pub enum TokenConverterError {
    #[msg("Invalid amount - must be greater than 0")]
    InvalidAmount,
    #[msg("Invalid inbound token mint")]
    InvalidInboundToken,
    #[msg("Invalid outbound token mint")]
    InvalidOutboundToken,
    #[msg("Invalid converter inbound token account")]
    InvalidConverterInboundTokenAccount,
    #[msg("Invalid converter outbound token account")]
    InvalidConverterOutboundTokenAccount,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Insufficient converter balance")]
    InsufficientConverterBalance,
    #[msg("Converter not active")]
    ConverterNotActive,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Assertion failed")]
    AssertFailed,
    #[msg("Inbound and outbound mints cannot be the same")]
    SameMint,
}