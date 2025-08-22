use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Locker {
    /// The price threshold that must be met for tokens to be unlocked
    pub price_threshold: u128,
    /// The amount of tokens locked
    pub token_amount: u64,
    /// The timestamp when unlocking can begin
    pub unlock_timestamp: i64,
    /// The oracle account that provides price data
    pub oracle_account: Pubkey,
    /// Byte offset in the oracle account where the aggregator value is stored
    pub aggregator_byte_offset: u8,
    /// Length of time in seconds for TWAP calculation
    pub twap_length_seconds: u64,
    /// The recipient of the tokens when unlocked
    pub token_recipient: Pubkey,
    /// The current state of the locker
    pub state: LockerState,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub enum LockerState {
    /// Initial state - waiting for unlock timestamp
    Locked,
    /// Unlocking has started - tracking TWAP
    Unlocking {
        /// The aggregator value when unlocking started
        start_aggregator: u128,
        /// The timestamp when unlocking started
        start_timestamp: i64,
    },
    /// Tokens have been unlocked and sent to recipient
    Unlocked,
}
