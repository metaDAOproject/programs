use anchor_lang::prelude::*;

use crate::{PriceBasedPerformancePackageError, MAX_TRANCHES};

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

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub struct Tranche {
    /// The price at which this tranch unlocks
    pub price_threshold: u128,
    /// The amount of tokens in this tranch
    pub token_amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub struct StoredTranche {
    pub price_threshold: u128,
    pub token_amount: u64,
    pub is_unlocked: bool,
}

impl From<Tranche> for StoredTranche {
    fn from(tranche: Tranche) -> Self {
        Self {
            price_threshold: tranche.price_threshold,
            token_amount: tranche.token_amount,
            is_unlocked: false,
        }
    }
}

#[account]
#[derive(InitSpace, Debug)]
pub struct PerformancePackage {
    /// The tranches that make up the performance package
    #[max_len(MAX_TRANCHES)]
    pub tranches: Vec<StoredTranche>,
    /// Total amount of tokens in the performance package
    pub total_token_amount: u64,
    /// Amount of tokens already unlocked
    pub already_unlocked_amount: u64,
    /// The timestamp when unlocking can begin
    pub min_unlock_timestamp: i64,
    /// Where to pull price data from
    pub oracle_config: OracleConfig,
    /// Length of time in seconds for TWAP calculation, between 1 day and 1 year
    pub twap_length_seconds: u32,
    /// The recipient of the tokens when unlocked
    pub recipient: Pubkey,
    /// The current state of the locker
    pub state: PerformancePackageState,
    /// Used to derive the PDA
    pub create_key: Pubkey,
    /// The PDA bump
    pub pda_bump: u8,
    /// The authorized locker authority that can execute changes, usually the organization
    pub performance_package_authority: Pubkey,
    /// The mint of the locked tokens
    pub token_mint: Pubkey,
    /// The sequence number of the performance package, used for indexing events
    pub seq_num: u64,
    /// The vault that stores the tokens
    pub performance_package_token_vault: Pubkey,
    /// Appended in 0.6.1; `None` means uncapped, and so do expired limits
    pub withdrawal_policy: Option<WithdrawalPolicy>,
}

impl PerformancePackage {
    /// Account size since 0.6.1 (582 bytes)
    pub const SIZE: usize = 8 + Self::INIT_SPACE;
    /// Account size before 0.6.1 (520 bytes)
    pub const OLD_SIZE: usize = 8 + OldPerformancePackage::INIT_SPACE;

    /// Ensure the package has been resized to the current layout.
    pub fn assert_migrated(info: &AccountInfo) -> Result<()> {
        require_eq!(
            info.data_len(),
            Self::SIZE,
            PriceBasedPerformancePackageError::AccountNotMigrated
        );
        Ok(())
    }

    /// Everything in the vault that is not still locked, "donations" included.
    pub fn withdrawable(&self, vault_amount: u64) -> Result<u64> {
        let locked = self
            .total_token_amount
            .checked_sub(self.already_unlocked_amount)
            .ok_or(PriceBasedPerformancePackageError::InvariantViolated)?;
        let withdrawable = vault_amount
            .checked_sub(locked)
            .ok_or(PriceBasedPerformancePackageError::InvariantViolated)?;
        Ok(withdrawable)
    }
}

/// The 0.6.0 layout, decoded by the resize before an account is migrated
#[derive(AnchorSerialize, AnchorDeserialize, InitSpace)]
pub struct OldPerformancePackage {
    #[max_len(MAX_TRANCHES)]
    pub tranches: Vec<StoredTranche>,
    pub total_token_amount: u64,
    pub already_unlocked_amount: u64,
    pub min_unlock_timestamp: i64,
    pub oracle_config: OracleConfig,
    pub twap_length_seconds: u32,
    pub recipient: Pubkey,
    pub state: PerformancePackageState,
    pub create_key: Pubkey,
    pub pda_bump: u8,
    pub performance_package_authority: Pubkey,
    pub token_mint: Pubkey,
    pub seq_num: u64,
    pub performance_package_token_vault: Pubkey,
}

/// The agreed limits together with the usage they are enforced against
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq, Eq, InitSpace)]
pub struct WithdrawalPolicy {
    pub limits: WithdrawalLimits,
    pub usage: WindowUsage,
}

/// Usage in the window the last withdrawal fell in
#[derive(
    AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq, Eq, InitSpace, Default,
)]
pub struct WindowUsage {
    /// `(now - limits.start_timestamp) / limits.window_seconds` at the last withdrawal
    pub window_index: i64,
    pub tokens_used: u64,
    pub quote_used: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq, Eq, InitSpace)]
pub struct WithdrawalLimits {
    /// Anchor for window boundaries; set by the program when limits take effect or `window_seconds` changes
    pub start_timestamp: i64,
    /// Caps apply while `now < end_timestamp`
    pub end_timestamp: i64,
    /// Duration of the window in seconds
    pub window_seconds: u32,
    /// Max base tokens withdrawn per window
    pub max_tokens_per_window: u64,
    /// Max quote value withdrawn per window, in quote atoms
    pub max_quote_per_window: u64,
    /// Which withdrawal routes the recipient may use while the caps are active
    pub withdrawal_mode: WithdrawalMode,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum WithdrawalMode {
    Tokens,
    Sell,
    Both,
}

impl WithdrawalMode {
    pub fn allows_tokens(&self) -> bool {
        matches!(self, WithdrawalMode::Tokens | WithdrawalMode::Both)
    }

    pub fn allows_sell(&self) -> bool {
        matches!(self, WithdrawalMode::Sell | WithdrawalMode::Both)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PerformancePackageState {
    /// Initial state - waiting for unlock timestamp
    Locked,
    /// Unlocking has started - tracking TWAP
    Unlocking {
        /// The aggregator value when unlocking started
        start_aggregator: u128,
        /// The timestamp when unlocking started
        start_timestamp: i64,
    },
}

impl ToString for PerformancePackageState {
    fn to_string(&self) -> String {
        match self {
            PerformancePackageState::Locked => "Locked".to_string(),
            PerformancePackageState::Unlocking {
                start_aggregator,
                start_timestamp,
            } => format!(
                "Unlocking (start_aggregator: {}, start_timestamp: {})",
                start_aggregator, start_timestamp
            ),
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub enum ChangeType {
    /// Change the oracle configuration
    Oracle { new_oracle_config: OracleConfig },
    /// Change the token recipient
    Recipient { new_recipient: Pubkey },
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub enum ProposerType {
    Recipient,
    Authority,
}

#[account]
#[derive(InitSpace)]
pub struct ChangeRequest {
    /// The performance package this change applies to
    pub performance_package: Pubkey,
    /// What is being changed
    pub change_type: ChangeType,
    /// When the change was proposed
    pub proposed_at: i64,
    /// Who proposed this change (either token_recipient or locker_authority)
    pub proposer_type: ProposerType,
    /// Used to derive the PDA along with the proposer
    pub pda_nonce: u32,
    /// The PDA bump
    pub pda_bump: u8,
}
