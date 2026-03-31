use crate::common::constants::MPL_TOKEN_METADATA_PROGRAM_ID;
use crate::common::types::launchpad_v_7;
use crate::common::types::launchpad_v_7::InitializeLaunchArgs;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

use crate::common::pda::get_launch_signer_pda;
use crate::common::pda::get_token_metadata_pda;
use crate::common::token::initialize_associated_token_account;

pub mod launchpad;

impl FuzzTest {
    fn mostly_valid_99(&mut self) -> bool {
        self.trident.random_from_range(1u8..=100u8) != 1
    }

    fn random_ascii_lower_string(&mut self, min_len: usize, max_len: usize) -> String {
        let min_len_u32 = min_len as u32;
        let max_len_u32 = max_len as u32;
        let len = self.trident.random_from_range(min_len_u32..=max_len_u32) as usize;
        (0..len)
            .map(|_| {
                let b = self.trident.random_from_range(b'a'..=b'z');
                b as char
            })
            .collect()
    }

    /// Generates `InitializeLaunchArgs` with constraints satisfied most of the time.
    ///
    /// Note: Our generated instruction builder always includes `additionalTokensRecipient`,
    /// so "valid" generation must set `additional_tokens_amount > 0` (otherwise the on-chain
    /// validation rejects).
    pub fn random_initialize_launch_args(
        &mut self,
        performance_package_grantee: Pubkey,
        team_address: Pubkey,
    ) -> InitializeLaunchArgs {
        const DAY: u32 = 60 * 60 * 24;
        const MAX_SECONDS_FOR_LAUNCH: u32 = 14 * DAY;
        const MIN_MONTHS_UNTIL_UNLOCK: u8 = 18;
        const MAX_PREMINE: u64 = 15_000_000 * 1_000_000;
        const MIN_QUOTE_LIQUIDITY: u64 = 100_000;
        const MIN_MINIMUM_RAISE: u64 = MIN_QUOTE_LIQUIDITY * 5;

        let mostly_valid = self.mostly_valid_99();

        // secondsForLaunch: valid is [1, 14 days] (and usually short to make CloseLaunch reachable)
        let seconds_for_launch: u32 = if mostly_valid {
            self.trident.random_from_range(60u32..=6 * 60 * 60) // 1 minute .. 6 hours
        } else {
            match self.trident.random_from_range(0u8..=4u8) {
                0 => 0,
                1 => 1,
                2 => MAX_SECONDS_FOR_LAUNCH + 1,
                3 => u32::MAX,
                _ => self
                    .trident
                    .random_from_range(60u32..=MAX_SECONDS_FOR_LAUNCH),
            }
        };

        // minimumRaiseAmount must be > 0, >= MIN_MINIMUM_RAISE, and >= monthlySpendingLimitAmount*6.
        let minimum_raise_amount: u64 = if mostly_valid {
            self.trident
                .random_from_range(MIN_MINIMUM_RAISE..=5_000_000u64) // 0.5 .. 5_000 USDC
        } else {
            match self.trident.random_from_range(0u8..=4u8) {
                0 => 0,
                1 => MIN_MINIMUM_RAISE.saturating_sub(1),
                2 => 1,
                3 => u64::MAX,
                _ => self
                    .trident
                    .random_from_range(MIN_MINIMUM_RAISE..=5_000_000_000u64),
            }
        };

        // monthlySpendingLimitAmount must be != 0 and satisfy *6 <= minimumRaiseAmount.
        let max_monthly = minimum_raise_amount.saturating_div(6).max(1);
        let monthly_spending_limit_amount: u64 = self.trident.random_from_range(1u64..=max_monthly);

        // monthlySpendingLimitMembers: valid len is 0..=10, but empty is fine on-chain.
        // Keep mostly non-empty to exercise CPI path in CompleteLaunch.
        let member_count: usize = if mostly_valid {
            self.trident.random_from_range(1u8..=3u8) as usize
        } else {
            match self.trident.random_from_range(0u8..=2u8) {
                0 => 0,
                1 => 11 + self.trident.random_from_range(0u8..=5u8) as usize,
                _ => 1,
            }
        };
        let mut members = Vec::with_capacity(member_count);
        for _ in 0..member_count {
            members.push(self.trident.random_keypair().pubkey());
        }

        // Token metadata strings: keep within typical MPL constraints most of the time.
        let token_name = if mostly_valid {
            // <= 32 chars
            self.random_ascii_lower_string(1, 16)
        } else {
            match self.trident.random_from_range(0u8..=2u8) {
                0 => "".to_string(),
                1 => self.random_ascii_lower_string(33, 64), // likely too long
                _ => self.random_ascii_lower_string(1, 16),
            }
        };
        let token_symbol = if mostly_valid {
            // <= 10 chars
            self.random_ascii_lower_string(1, 6).to_uppercase()
        } else {
            match self.trident.random_from_range(0u8..=2u8) {
                0 => "".to_string(),
                1 => self.random_ascii_lower_string(11, 20).to_uppercase(),
                _ => self.random_ascii_lower_string(1, 6).to_uppercase(),
            }
        };
        let token_uri = if mostly_valid {
            format!(
                "https://example.com/{}",
                self.random_ascii_lower_string(4, 12)
            )
        } else {
            match self.trident.random_from_range(0u8..=2u8) {
                0 => "".to_string(),
                1 => self.random_ascii_lower_string(200, 400), // likely too long / invalid URI
                _ => format!(
                    "https://example.com/{}",
                    self.random_ascii_lower_string(4, 12)
                ),
            }
        };

        // performancePackageTokenAmount: valid is [10, MAX_PREMINE], and monthsUntilInsidersCanUnlock >= 18.
        let performance_package_token_amount: u64 = if mostly_valid {
            self.trident
                .random_from_range(10_000u64..=1_000_000_000_000u64)
                .clamp(10, MAX_PREMINE)
                .max(10)
        } else {
            match self.trident.random_from_range(0u8..=4u8) {
                0 => 0,
                1 => 9,
                2 => MAX_PREMINE.saturating_add(1),
                3 => u64::MAX,
                _ => self
                    .trident
                    .random_from_range(10_000u64..=1_000_000_000_000u64)
                    .clamp(10, MAX_PREMINE)
                    .max(10),
            }
        };

        let months_until_insiders_can_unlock: u8 = if mostly_valid {
            self.trident
                .random_from_range(MIN_MONTHS_UNTIL_UNLOCK..=36u8)
        } else {
            match self.trident.random_from_range(0u8..=3u8) {
                0 => 0,
                1 => MIN_MONTHS_UNTIL_UNLOCK - 1,
                2 => 255,
                _ => self
                    .trident
                    .random_from_range(MIN_MONTHS_UNTIL_UNLOCK..=36u8),
            }
        };

        // additionalTokensAmount: "valid" must be > 0 due to the always-present optional account in our builder.
        let additional_tokens_amount: u64 = if mostly_valid {
            self.trident.random_from_range(1u64..=5_000_000_000u64)
        } else {
            match self.trident.random_from_range(0u8..=3u8) {
                0 => 0, // should fail (recipient always provided)
                1 => u64::MAX,
                _ => self.trident.random_from_range(1u64..=5_000_000_000u64),
            }
        };

        let accumulator_activation_delay_seconds: u32 = if mostly_valid {
            self.trident.random_from_range(0u32..=seconds_for_launch)
        } else {
            match self.trident.random_from_range(0u8..=3u8) {
                0 => 0,
                1 => MAX_SECONDS_FOR_LAUNCH.saturating_add(1),
                2 => u32::MAX,
                _ => self
                    .trident
                    .random_from_range(0u32..=MAX_SECONDS_FOR_LAUNCH),
            }
        };

        InitializeLaunchArgs::new(
            minimum_raise_amount,
            monthly_spending_limit_amount,
            members,
            seconds_for_launch,
            token_name,
            token_symbol,
            token_uri,
            performance_package_grantee,
            performance_package_token_amount,
            months_until_insiders_can_unlock,
            team_address,
            additional_tokens_amount,
            accumulator_activation_delay_seconds,
            false,
        )
    }

    pub fn random_fund_amount(&mut self, funder_balance: u64) -> u64 {
        // 99% valid-ish, 1% invalid-ish (0 or > balance)
        let mostly_valid = self.mostly_valid_99();
        if mostly_valid {
            if funder_balance == 0 {
                return 0;
            }
            let upper = funder_balance.min(2_000_000_000);
            self.trident.random_from_range(1u64..=upper.max(1))
        } else {
            match self.trident.random_from_range(0u8..=4u8) {
                0 => 0,
                1 => funder_balance.saturating_add(1),
                2 => u64::MAX,
                3 => self.trident.random_from_range(0u64..=10u64),
                _ => {
                    if funder_balance == 0 {
                        1
                    } else {
                        self.trident.random_from_range(1u64..=funder_balance)
                    }
                }
            }
        }
    }

    pub fn random_approved_amount(&mut self, committed_amount: u64) -> u64 {
        // 99% within bounds, 1% out-of-bounds
        let mostly_valid = self.mostly_valid_99();
        if mostly_valid {
            self.trident.random_from_range(0u64..=committed_amount)
        } else {
            match self.trident.random_from_range(0u8..=3u8) {
                0 => committed_amount.saturating_add(1),
                1 => u64::MAX,
                2 => committed_amount.saturating_add(10),
                _ => self.trident.random_from_range(0u64..=committed_amount),
            }
        }
    }

    pub fn initial_setup(&mut self) {
        self.trident
            .airdrop(&self.payer.pubkey(), 500 * LAMPORTS_PER_SOL);
    }

    pub fn initialize_token_metadata(&mut self, base_mint: Pubkey) -> Pubkey {
        let token_metadata = get_token_metadata_pda(&mut self.trident, base_mint);
        self.trident.create_account(
            &self.payer.pubkey(),
            &token_metadata,
            1000000,
            10000,
            &MPL_TOKEN_METADATA_PROGRAM_ID,
        );
        token_metadata
    }

    pub fn initialize_launch_signer(&mut self, launch: Pubkey) -> Pubkey {
        let launch_signer = get_launch_signer_pda(&mut self.trident, launch);
        self.trident.create_account(
            &self.payer.pubkey(),
            &launch_signer,
            1000000,
            10000,
            &launchpad_v_7::program_id(),
        );
        launch_signer
    }

    pub fn setup_funder_accounts(
        &mut self,
        quote_mint: Pubkey,
        funder_token_amount: u64,
        mint_authority: Pubkey,
    ) -> (Pubkey, Pubkey) {
        let funder = self.trident.random_keypair();
        let funder_quote_account = initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            quote_mint,
            funder.pubkey(),
        );
        let mint_to_funder_quote_account_ix = self.trident.mint_to(
            &funder_quote_account,
            &quote_mint,
            &mint_authority,
            funder_token_amount,
        );
        self.trident
            .process_transaction(&[mint_to_funder_quote_account_ix], None);
        (funder.pubkey(), funder_quote_account)
    }

    // pub fn get_or_initialize_associated_token_account(
    //     &mut self,
    //     payer: Pubkey,
    //     mint: Pubkey,
    //     owner: Pubkey,
    // ) -> Pubkey {
    //     let ata = self
    //         .trident
    //         .get_associated_token_address(&mint, &owner, &TOKEN_PROGRAM_ID);

    //     let ata_acc = self.trident.get_token_account(ata);

    //     if ata_acc.is_err() {
    //         let ix = self
    //             .trident
    //             .initialize_associated_token_account(&payer, &mint, &owner);

    //         let res = self.trident.process_transaction(&[ix], None);
    //         invariant!(res.is_success());
    //     }

    //     ata
    // }
}
