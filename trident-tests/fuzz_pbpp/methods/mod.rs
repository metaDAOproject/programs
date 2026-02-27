use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

use crate::common::token::initialize_associated_token_account;
use crate::common::token::initialize_mint;
use crate::common::token::mint_to;
use crate::common::types::price_based_performance_package::InitializePerformancePackageParams;
pub mod pbpp;

impl FuzzTest {
    pub fn initial_setup(&mut self) {
        self.trident
            .airdrop(&self.payer.pubkey(), 500 * LAMPORTS_PER_SOL);
    }

    /// Creates/overwrites a mock oracle account with the layout expected by our PBPP oracle config:
    /// - `u128` aggregator (LE) at `byte_offset`
    /// - `i64` last_updated_timestamp (LE) immediately after
    pub fn upsert_mock_oracle_u128_i64(
        &mut self,
        oracle: Pubkey,
        owner: Pubkey,
        byte_offset: usize,
        aggregator: u128,
        last_updated_timestamp: i64,
    ) {
        let data_len = byte_offset
            .checked_add(16 + 8)
            .expect("oracle data length overflow");
        let mut oracle_data = vec![0u8; data_len];
        oracle_data[byte_offset..byte_offset + 16].copy_from_slice(&aggregator.to_le_bytes());
        oracle_data[byte_offset + 16..byte_offset + 24]
            .copy_from_slice(&last_updated_timestamp.to_le_bytes());

        let rent = self.trident.get_sysvar::<solana_sdk::rent::Rent>();
        let lamports = rent.minimum_balance(oracle_data.len());
        let mut oracle_account_state = AccountSharedData::new(lamports, oracle_data.len(), &owner);
        oracle_account_state.set_data_from_slice(&oracle_data);
        self.trident
            .set_account_custom(&oracle, &oracle_account_state);
    }

    pub fn setup_mint(&mut self) -> Pubkey {
        let mint = self.trident.random_keypair();
        initialize_mint(
            &mut self.trident,
            self.payer.pubkey(),
            mint.pubkey(),
            6,
            self.payer.pubkey(),
            None,
            None,
        );
        mint.pubkey()
    }

    pub fn setup_grantor_accounts(&mut self, token_mint: Pubkey) -> (Pubkey, Pubkey) {
        let grantor = self.trident.random_keypair();
        let grantor_ata = initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            token_mint,
            grantor.pubkey(),
        );
        mint_to(
            &mut self.trident,
            grantor_ata,
            token_mint,
            self.payer.pubkey(),
            1_000_000_000_000,
        );
        (grantor.pubkey(), grantor_ata)
    }

    pub fn random_initialize_performance_package_params(
        &mut self,
        current_timestamp: i64,
        oracle_account: Pubkey,
        oracle_byte_offset: u32,
        grantee: Pubkey,
        performance_package_authority: Pubkey,
    ) -> InitializePerformancePackageParams {
        use crate::common::types::price_based_performance_package::InitializePerformancePackageParams;
        use crate::common::types::price_based_performance_package::OracleConfig;
        use crate::common::types::price_based_performance_package::Tranche;

        // 99% valid, 1% invalid
        let mostly_valid = self.trident.random_from_range(1u8..=100u8) != 1;

        // Tranches: valid is 1..=10 (i.e., < 11)
        let tranche_count: usize = if mostly_valid {
            self.trident.random_from_range(1u32..=10u32) as usize
        } else {
            match self.trident.random_from_range(0u8..=2u8) {
                0 => 0,
                1 => 11 + self.trident.random_from_range(0u32..=5u32) as usize,
                _ => self.trident.random_from_range(1u32..=10u32) as usize,
            }
        };

        let mut tranches = Vec::with_capacity(tranche_count);
        let mut threshold: u128 = 0;
        for _ in 0..tranche_count {
            threshold = threshold
                .saturating_add(self.trident.random_from_range(0u64..=1_000_000_u64) as u128)
                .saturating_add(1);
            let token_amount = self.trident.random_from_range(1u64..=10_000_000u64);
            tranches.push(Tranche::new(threshold, token_amount));
        }

        // minUnlockTimestamp: valid is in the future relative to init time.
        // Keep it within ~1 hour so the later `forward_in_time(1h)` tends to satisfy StartUnlock.
        let min_unlock_timestamp = if mostly_valid {
            current_timestamp + self.trident.random_from_range(1i64..=60 * 60)
        } else {
            match self.trident.random_from_range(0u8..=1u8) {
                0 => current_timestamp,     // not in future
                _ => current_timestamp - 1, // in the past
            }
        };

        // twapLengthSeconds: valid is [1 day, 1 year]
        const DAY: u32 = 60 * 60 * 24;
        const YEAR: u32 = 60 * 60 * 24 * 365;
        let twap_length_seconds = if mostly_valid {
            self.trident.random_from_range(DAY..=YEAR)
        } else {
            match self.trident.random_from_range(0u8..=4u8) {
                0 => 0,
                1 => 1,
                2 => DAY - 1,
                3 => YEAR + 1,
                _ => u32::MAX,
            }
        };

        let oracle_config = OracleConfig::new(oracle_account, oracle_byte_offset);
        InitializePerformancePackageParams::new(
            tranches,
            min_unlock_timestamp,
            oracle_config,
            twap_length_seconds,
            grantee,
            performance_package_authority,
        )
    }
}
