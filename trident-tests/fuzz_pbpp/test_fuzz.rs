use fuzz_accounts::*;
use trident_fuzz::fuzzing::*;
mod fuzz_accounts;
mod invariants;

pub mod methods;

#[path = "../common/mod.rs"]
pub mod common;
use crate::common::constants::*;
use crate::common::pda::get_change_request_pda;
use crate::common::pda::get_performance_package_pda;
use crate::common::token::initialize_associated_token_account;
use crate::common::types::price_based_performance_package::*;
#[derive(FuzzTestMethods)]
struct FuzzTest {
    /// Trident client for interacting with the Solana program
    trident: Trident,
    /// Storage for all account addresses used in fuzz testing
    fuzz_accounts: AccountAddresses,

    // ============================================================================
    // Accounts
    payer: Keypair,
    // ============================================================================
}

#[flow_executor]
impl FuzzTest {
    fn new() -> Self {
        let mut trident = Trident::default();

        let payer = trident.random_keypair();

        Self {
            trident,
            fuzz_accounts: AccountAddresses::default(),
            payer,
        }
    }

    #[init]
    fn start(&mut self) {
        self.initial_setup();

        // Core accounts
        let create_key = self.trident.random_keypair();
        let oracle_account = self.trident.random_keypair();
        let performance_package =
            get_performance_package_pda(&mut self.trident, create_key.pubkey());

        // Token mint + funding
        let token_mint = self.setup_mint();
        let (grantor, grantor_token_account) = self.setup_grantor_accounts(token_mint);
        let performance_package_token_vault = initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            token_mint,
            performance_package,
        );

        // Two recipients + two authorities (we want 50% chance to pick the correct one in flows).
        let recipient_a = self.trident.random_keypair().pubkey();
        let recipient_b = self.trident.random_keypair().pubkey();
        let authority_a = self.payer.pubkey();
        let authority_b = self.trident.random_keypair().pubkey();

        // Seed ATAs for both recipients.
        let recipient_a_token_account = initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            token_mint,
            recipient_a,
        );
        let recipient_b_token_account = initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            token_mint,
            recipient_b,
        );

        // Persist addresses for flows
        self.fuzz_accounts
            .createKey
            .insert_with_address(create_key.pubkey());
        self.fuzz_accounts
            .performancePackage
            .insert_with_address(performance_package);
        self.fuzz_accounts
            .oracleAccount
            .insert_with_address(oracle_account.pubkey());
        self.fuzz_accounts.tokenMint.insert_with_address(token_mint);
        self.fuzz_accounts.grantor.insert_with_address(grantor);
        self.fuzz_accounts
            .grantorTokenAccount
            .insert_with_address(grantor_token_account);
        self.fuzz_accounts
            .performancePackageTokenVault
            .insert_with_address(performance_package_token_vault);
        self.fuzz_accounts
            .recipient
            .insert_with_address(recipient_a);
        self.fuzz_accounts
            .recipient
            .insert_with_address(recipient_b);
        self.fuzz_accounts
            .recipientTokenAccount
            .insert_with_address(recipient_a_token_account);
        self.fuzz_accounts
            .recipientTokenAccount
            .insert_with_address(recipient_b_token_account);
        self.fuzz_accounts
            .currentAuthority
            .insert_with_address(authority_a);
        self.fuzz_accounts
            .currentAuthority
            .insert_with_address(authority_b);

        // Initialize performance package (mostly-valid, occasionally-invalid to test rejects)
        let current_timestamp = self.trident.get_current_timestamp();
        let initialize_performance_package_args = self
            .random_initialize_performance_package_params(
                current_timestamp,
                oracle_account.pubkey(),
                0,
                recipient_a,
                authority_a,
            );

        self.initialize_performance_package(
            self.payer.pubkey(),
            performance_package,
            create_key.pubkey(),
            token_mint,
            grantor_token_account,
            grantor,
            performance_package_token_vault,
            initialize_performance_package_args,
            Some("Instruction: Initialize Performance Package"),
        );
    }

    #[flow]
    fn flow1_start_unlock(&mut self) {
        let performance_package = self
            .fuzz_accounts
            .performancePackage
            .get(&mut self.trident)
            .expect("performancePackage must be set");

        let pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8));
        if pp.is_none() {
            return;
        }
        let pp = pp.unwrap();

        // If we're not locked, don't spam meaningless failures (but rarely still try).
        if !matches!(pp.state, PerformancePackageState::Locked)
            && self.trident.random_from_range(1u8..=100u8) != 1
        {
            return;
        }

        // 50% correct recipient, 50% wrong (picked from our two known recipients)
        let recipient = self
            .fuzz_accounts
            .recipient
            .get(&mut self.trident)
            .expect("recipient must be set");

        // 99%: set up oracle + time so StartUnlock passes
        let mostly_valid = self.trident.random_from_range(1u8..=100u8) != 1;

        if mostly_valid {
            let now = self.trident.get_current_timestamp();
            if now < pp.minUnlockTimestamp {
                self.trident
                    .forward_in_time((pp.minUnlockTimestamp - now) + 1);
            }
            let now = self.trident.get_current_timestamp();
            let start_agg = self.trident.random_from_range(1u64..=10_000_000u64) as u128;
            self.upsert_mock_oracle_u128_i64(
                pp.oracleConfig.oracleAccount,
                program_id(),
                pp.oracleConfig.byteOffset as usize,
                start_agg,
                now,
            );
        } else {
            // 1%: intentionally wrong setup
            match self.trident.random_from_range(0u8..=2u8) {
                0 => {
                    // don't touch oracle at all => InvalidOracleData likely
                }
                1 => {
                    // oracle timestamp too early
                    let bad_ts = pp.minUnlockTimestamp.saturating_sub(1);
                    let start_agg = self.trident.random_from_range(1u64..=10_000_000u64) as u128;
                    self.upsert_mock_oracle_u128_i64(
                        pp.oracleConfig.oracleAccount,
                        program_id(),
                        pp.oracleConfig.byteOffset as usize,
                        start_agg,
                        bad_ts,
                    );
                }
                _ => {
                    // oracle timestamp in the future (clock < ts)
                    let now = self.trident.get_current_timestamp();
                    let bad_ts = now.saturating_add(1);
                    let start_agg = self.trident.random_from_range(1u64..=10_000_000u64) as u128;
                    self.upsert_mock_oracle_u128_i64(
                        pp.oracleConfig.oracleAccount,
                        program_id(),
                        pp.oracleConfig.byteOffset as usize,
                        start_agg,
                        bad_ts,
                    );
                }
            }
        }

        self.start_unlock(
            recipient,
            performance_package,
            pp.oracleConfig.oracleAccount,
            Some("Flow1: StartUnlock"),
        );
    }

    #[flow]
    fn flow2_complete_unlock(&mut self) {
        let performance_package = self
            .fuzz_accounts
            .performancePackage
            .get(&mut self.trident)
            .expect("performancePackage must be set");

        let pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8));
        if pp.is_none() {
            return;
        }
        let pp = pp.unwrap();

        // Only makes sense when Unlocking; otherwise return most of the time.
        if !matches!(pp.state, PerformancePackageState::Unlocking { .. })
            && self.trident.random_from_range(1u8..=100u8) != 1
        {
            return;
        }

        let recipient = self
            .fuzz_accounts
            .recipient
            .get(&mut self.trident)
            .expect("recipient must be set");

        // 99%: set up oracle + time so CompleteUnlock passes (modulo wrong token_recipient)
        let mostly_valid = self.trident.random_from_range(1u8..=100u8) != 1;

        if let PerformancePackageState::Unlocking {
            startAggregator,
            startTimestamp,
        } = pp.state
        {
            if mostly_valid {
                let target_ts = startTimestamp + pp.twapLengthSeconds as i64 + 1;
                let now = self.trident.get_current_timestamp();
                if now < target_ts {
                    self.trident.forward_in_time((target_ts - now) + 1);
                }

                let now = self.trident.get_current_timestamp();
                let time_passed = now.saturating_sub(startTimestamp).max(1);
                let max_threshold = pp
                    .tranches
                    .iter()
                    .map(|t| t.priceThreshold)
                    .max()
                    .unwrap_or(0);

                let end_agg = startAggregator.saturating_add(
                    (max_threshold.saturating_add(1)).saturating_mul(time_passed as u128),
                );

                self.upsert_mock_oracle_u128_i64(
                    pp.oracleConfig.oracleAccount,
                    program_id(),
                    pp.oracleConfig.byteOffset as usize,
                    end_agg,
                    now,
                );
            } else {
                // 1%: intentionally fail (too little time or too little price increase)
                match self.trident.random_from_range(0u8..=1u8) {
                    0 => {
                        let now = self.trident.get_current_timestamp();
                        let target_ts =
                            startTimestamp + (pp.twapLengthSeconds as i64).saturating_sub(1);
                        if now < target_ts {
                            self.trident.forward_in_time((target_ts - now) + 1);
                        }
                        let now = self.trident.get_current_timestamp();
                        self.upsert_mock_oracle_u128_i64(
                            pp.oracleConfig.oracleAccount,
                            program_id(),
                            pp.oracleConfig.byteOffset as usize,
                            startAggregator.saturating_add(1),
                            now,
                        );
                    }
                    _ => {
                        let target_ts = startTimestamp + pp.twapLengthSeconds as i64 + 1;
                        let now = self.trident.get_current_timestamp();
                        if now < target_ts {
                            self.trident.forward_in_time((target_ts - now) + 1);
                        }
                        let now = self.trident.get_current_timestamp();
                        self.upsert_mock_oracle_u128_i64(
                            pp.oracleConfig.oracleAccount,
                            program_id(),
                            pp.oracleConfig.byteOffset as usize,
                            startAggregator.saturating_add(1),
                            now,
                        );
                    }
                }
            }
        }

        let recipient_token_account =
            self.trident
                .get_associated_token_address(&pp.tokenMint, &recipient, &TOKEN_PROGRAM_ID);

        self.complete_unlock(
            performance_package,
            pp.oracleConfig.oracleAccount,
            pp.performancePackageTokenVault,
            pp.tokenMint,
            recipient_token_account,
            recipient,
            self.payer.pubkey(),
            Some("Flow2: CompleteUnlock"),
        );
    }

    #[flow]
    fn flow3_admin_bundle(&mut self) {
        let performance_package = self
            .fuzz_accounts
            .performancePackage
            .get(&mut self.trident)
            .expect("performancePackage must be set");

        let pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8));
        if pp.is_none() {
            return;
        }
        let pp = pp.unwrap();

        // It is possible that random is same as the current authority or recipient.
        let random_recipient = self
            .fuzz_accounts
            .recipient
            .get(&mut self.trident)
            .expect("recipient must be set");
        let random_authority = self
            .fuzz_accounts
            .currentAuthority
            .get(&mut self.trident)
            .expect("currentAuthority must be set");

        // 1/3: change authority (switch between the two)
        if self.trident.random_from_range(0u8..=2u8) == 0 {
            let authority = if self.trident.random_from_range(0u8..10u8) != 0 {
                random_authority
            } else {
                pp.performancePackageAuthority
            };

            self.change_performance_package_authority(
                performance_package,
                authority,
                ChangePerformancePackageAuthorityParams::new(random_authority),
                Some("Flow3: ChangePerformancePackageAuthority"),
            );
            return;
        }

        // Otherwise: propose + execute a change (recipient or oracle)
        let proposer = if self.trident.random_from_range(0u8..=1u8) == 0 {
            if self.trident.random_from_range(0u8..10u8) != 0 {
                pp.recipient
            } else {
                random_recipient
            }
        } else if self.trident.random_from_range(0u8..10u8) != 0 {
            pp.performancePackageAuthority
        } else {
            random_authority
        };

        let pda_nonce = self.trident.random_from_range(0u32..=u32::MAX);
        let change_request =
            get_change_request_pda(&mut self.trident, performance_package, proposer, pda_nonce);

        let change_type = if self.trident.random_from_range(0u8..=1u8) == 0 {
            ChangeType::Recipient {
                newRecipient: random_recipient,
            }
        } else {
            let new_oracle = self.trident.random_keypair().pubkey();
            ChangeType::Oracle {
                newOracleConfig: OracleConfig::new(new_oracle, pp.oracleConfig.byteOffset),
            }
        };

        self.propose_change(
            self.payer.pubkey(),
            change_request,
            performance_package,
            proposer,
            ProposeChangeParams::new(change_type, pda_nonce),
            Some("Flow3: ProposeChange"),
        );

        let executor = if proposer == pp.recipient || proposer == random_recipient {
            pp.performancePackageAuthority
        } else {
            pp.recipient
        };

        self.execute_change(
            change_request,
            performance_package,
            executor,
            Some("Flow3: ExecuteChange"),
        );

        // If the executed change updated the oracle config, keep fuzz_accounts in sync.
        let pp_after = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist");
        if pp_after.oracleConfig.oracleAccount != pp.oracleConfig.oracleAccount {
            self.fuzz_accounts
                .oracleAccount
                .remove(&pp.oracleConfig.oracleAccount);
            self.fuzz_accounts
                .oracleAccount
                .insert_with_address(pp_after.oracleConfig.oracleAccount);
        }
    }
}

fn main() {
    FuzzTest::fuzz(10000, 1000);
}
