use anchor_lang::prelude::*;

/// Starting at `byte_offset` in `oracle_account`, this program expects to read:
/// - 16 bytes for the aggregator, stored as a little endian u128
/// - 8 bytes for the slot that the aggregator was last updated, stored as a 
///   little endian u64
/// 
/// The aggregator should be a weighted sum of prices, where the weight is the
/// number of seconds between prices. Here's an example:
/// - at second 0, the aggregator is 0
/// - at second 1, the price is 10 and the aggregator is 10 (10 * 1)
/// - at second 4, the price is 11 and 3 seconds have passed, so the aggregator is
///   10 + 11 * 3 = 43
/// 
/// This allows our program to read a TWAP over a time period by reading the
/// aggregator value at the beginning and at the end, and dividing the difference
/// by the number of seconds between the two.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq, InitSpace, Copy)]
pub struct OracleConfig {
    pub oracle_account: Pubkey,
    pub byte_offset: u32,
}

#[account]
#[derive(InitSpace)]
pub struct Locker {
    /// The price threshold that must be met for tokens to be unlocked
    pub price_threshold: u128,
    /// The amount of tokens locked
    pub token_amount: u64,
    /// The timestamp when unlocking can begin
    pub unlock_timestamp: i64,
    /// Where to pull price data from
    pub oracle_config: OracleConfig,
    /// Length of time in seconds for TWAP calculation
    pub twap_length_seconds: u64,
    /// The recipient of the tokens when unlocked
    pub token_recipient: Pubkey,
    /// The current state of the locker
    pub state: LockerState,
    /// Used to derive the PDA
    pub create_key: Pubkey,
    /// The PDA bump
    pub pda_bump: u8,
    /// The authorized locker authority that can execute changes
    pub locker_authority: Pubkey,
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
    /// A change has been proposed and is pending recipient approval
    PendingChange {
        /// The change request PDA address
        change_request: Pubkey,
    },
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub enum ChangeType {
    /// Change the oracle configuration
    Oracle { new_oracle_config: OracleConfig },
    /// Change the token recipient
    Recipient { new_recipient: Pubkey },
}

#[account]
#[derive(InitSpace)]
pub struct ChangeRequest {
    /// The locker this change applies to
    pub locker: Pubkey,
    /// What is being changed
    pub change_type: ChangeType,
    /// When the change was proposed
    pub proposed_at: i64,
    /// The locker state before the change was proposed
    pub previous_state: LockerState,
    /// Who proposed this change (either token_recipient or locker_authority)
    pub proposer: Pubkey,
    /// Used to derive the PDA
    pub create_key: Pubkey,
    /// The PDA bump
    pub pda_bump: u8,
}
