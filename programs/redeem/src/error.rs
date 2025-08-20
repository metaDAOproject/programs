use anchor_lang::prelude::*;

#[error_code]
pub enum RedeemError {
    #[msg("Invalid authority - treasury does not own the token account")]
    InvalidAuthority,
    
    #[msg("Invalid treasury PDA")]
    InvalidTreasuryPDA,
    
    #[msg("Invalid pool configuration")]
    InvalidPoolConfiguration,

    #[msg("Invalid pool configuration for token 0")]
    InvalidPoolConfigurationToken0,

    #[msg("Invalid pool configuration for token 1")]
    InvalidPoolConfigurationToken1,

    #[msg("Invalid pool configuration for LP Mint")]
    InvalidPoolConfigurationLpMint,
    
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    
    #[msg("No LP tokens to withdraw")]
    NoLpTokens,
    
    #[msg("Invalid pool vault")]
    InvalidPoolVault,
    
    #[msg("Invalid destination account")]
    InvalidDestination,
    
    #[msg("Invalid mint - does not match DAO configuration")]
    InvalidMint,
    
    #[msg("Wrong pool - pool tokens don't match DAO configuration")]
    WrongPool,
    
    #[msg("Withdrawals are disabled for this pool")]
    WithdrawalsDisabled,

    #[msg("Migrator vault not initialized")]
    MigratorVaultNotInitialized,

    #[msg("Migrator vault must be funded to receive USDC")]
    MigratorVaultNotFunded,
}