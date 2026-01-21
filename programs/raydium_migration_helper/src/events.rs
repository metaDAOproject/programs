use anchor_lang::prelude::*;

#[event]
pub struct MigrationExecuted {
    /// The vault authority that executed the migration
    pub vault_authority: Pubkey,
    /// Amount of LP tokens withdrawn from Raydium
    pub lp_amount: u64,
    /// Amount of base tokens withdrawn from Raydium LP
    pub withdrawn_base: u64,
    /// Amount of quote tokens withdrawn from Raydium LP
    pub withdrawn_quote: u64,
    /// Amount of base tokens sent to Meteora DAMM v2 pool (10%)
    pub base_to_meteora: u64,
    /// Amount of quote tokens sent to Meteora DAMM v2 pool (10%)
    pub quote_to_meteora: u64,
    /// Amount of base tokens sent to Futarchy AMM (90%)
    pub base_to_futarchy: u64,
    /// Amount of quote tokens sent to Futarchy AMM (90%)
    pub quote_to_futarchy: u64,
    /// The Meteora DAMM v2 pool that was created
    pub meteora_pool: Pubkey,
    /// Amount of base tokens transferred to V6 vault treasury
    pub treasury_base_transferred: u64,
    /// Amount of quote tokens transferred to V6 vault treasury
    pub treasury_quote_transferred: u64,
}
