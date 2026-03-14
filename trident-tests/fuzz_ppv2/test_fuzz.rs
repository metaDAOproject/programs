use fuzz_accounts::*;
use trident_fuzz::fuzzing::*;
mod fuzz_accounts;
mod invariants;

pub mod methods;

#[path = "../common/mod.rs"]
pub mod common;
use crate::common::constants::*;
use crate::common::pda::get_change_request_pda_v2;
use crate::common::pda::get_event_authority_pda;
use crate::common::pda::get_mint_authority_pda;
use crate::common::pda::get_mint_governor_pda;
use crate::common::pda::get_performance_package_pda_v2;
use crate::common::types::mint_governor;
use crate::common::types::mint_governor::AddMintAuthorityArgs;
use crate::common::types::mint_governor::AddMintAuthorityInstruction;
use crate::common::types::mint_governor::AddMintAuthorityInstructionAccounts;
use crate::common::types::mint_governor::AddMintAuthorityInstructionData;
use crate::common::types::mint_governor::InitializeMintGovernorInstruction;
use crate::common::types::mint_governor::InitializeMintGovernorInstructionAccounts;
use crate::common::types::mint_governor::InitializeMintGovernorInstructionData;
use crate::common::types::mint_governor::TransferAuthorityToGovernorInstruction;
use crate::common::types::mint_governor::TransferAuthorityToGovernorInstructionAccounts;
use crate::common::types::mint_governor::TransferAuthorityToGovernorInstructionData;
use crate::common::types::performance_package_v_2::*;

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
            get_performance_package_pda_v2(&mut self.trident, create_key.pubkey());

        let token_mint = self.setup_mint();
        let mint_governor = get_mint_governor_pda(&mut self.trident, token_mint, create_key.pubkey());
        let mint_authority =
            get_mint_authority_pda(&mut self.trident, mint_governor, performance_package);

        // Two recipients + two authorities (we want 50% chance to pick the correct one in flows).
        let recipient_a = self.trident.random_keypair().pubkey();
        let recipient_b = self.trident.random_keypair().pubkey();
        let authority_a = self.payer.pubkey();
        let authority_b = self.trident.random_keypair().pubkey();

        let recipient_a_token_account = self.setup_recipient_token_account(token_mint, recipient_a);
        let recipient_b_token_account = self.setup_recipient_token_account(token_mint, recipient_b);

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

        let mint_governor_event_authority =
            get_event_authority_pda(&mut self.trident, mint_governor::program_id());
        let init_mint_governor = InitializeMintGovernorInstruction::data(
            InitializeMintGovernorInstructionData::new(),
        )
        .accounts(InitializeMintGovernorInstructionAccounts::new(
            token_mint,
            mint_governor,
            create_key.pubkey(),
            self.payer.pubkey(),
            self.payer.pubkey(),
            SOLANA_PROGRAM_ID,
            mint_governor_event_authority,
            mint_governor::program_id(),
        ))
        .instruction();
        let transfer_authority_to_governor = TransferAuthorityToGovernorInstruction::data(
            TransferAuthorityToGovernorInstructionData::new(),
        )
        .accounts(TransferAuthorityToGovernorInstructionAccounts::new(
            mint_governor,
            token_mint,
            self.payer.pubkey(),
            TOKEN_PROGRAM_ID,
            mint_governor_event_authority,
            mint_governor::program_id(),
        ))
        .instruction();
        let add_mint_authority = AddMintAuthorityInstruction::data(
            AddMintAuthorityInstructionData::new(AddMintAuthorityArgs::new(None)),
        )
        .accounts(AddMintAuthorityInstructionAccounts::new(
            mint_governor,
            mint_authority,
            self.payer.pubkey(),
            performance_package,
            self.payer.pubkey(),
            SOLANA_PROGRAM_ID,
            mint_governor_event_authority,
            mint_governor::program_id(),
        ))
        .instruction();
        self.trident.process_transaction(
            &[
                init_mint_governor,
                transfer_authority_to_governor,
                add_mint_authority,
            ],
            Some("Setup: Mint governor"),
        );

        let current_timestamp = self.trident.get_current_timestamp();
        let initialize_args = self.random_initialize_performance_package_args(
            current_timestamp,
            oracle_account.pubkey(),
        );

        self.initialize_performance_package(
            self.payer.pubkey(),
            performance_package,
            token_mint,
            mint_governor,
            mint_authority,
            create_key.pubkey(),
            authority_a,
            recipient_a,
            initialize_args,
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

        let Some(pp) = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
        else {
            return;
        };

        if !matches!(pp.status, PackageStatus::Locked)
            && self.trident.random_from_range(1u8..=100u8) != 1
        {
            return;
        }

        let signer = self
            .fuzz_accounts
            .recipient
            .get(&mut self.trident)
            .expect("recipient must be set");

        let mostly_valid = self.trident.random_from_range(1u8..=100u8) != 1;
        if mostly_valid {
            let now = self.trident.get_current_timestamp();
            if now < pp.minUnlockTimestamp {
                self.trident
                    .forward_in_time((pp.minUnlockTimestamp - now).saturating_add(1));
            }
        }

        self.start_unlock(
            signer,
            performance_package,
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

        let Some(pp) = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
        else {
            return;
        };

        if !matches!(pp.status, PackageStatus::Unlocking)
            && self.trident.random_from_range(1u8..=100u8) != 1
        {
            return;
        }

        let authority_candidate = self
            .fuzz_accounts
            .currentAuthority
            .get(&mut self.trident)
            .expect("currentAuthority must be set");
        let signer = if self.trident.random_from_range(0u8..=1u8) == 0 {
            pp.recipient
        } else if self.trident.random_from_range(0u8..10u8) != 0 {
            pp.authority
        } else {
            authority_candidate
        };

        let recipient_token_account =
            self.trident
                .get_associated_token_address(&pp.mint, &pp.recipient, &TOKEN_PROGRAM_ID);

        self.complete_unlock(
            performance_package,
            pp.mintGovernor,
            pp.mintAuthority,
            pp.mint,
            recipient_token_account,
            signer,
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

        let Some(pp) = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
        else {
            return;
        };

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

        if self.trident.random_from_range(0u8..=7u8) == 0 {
            self.close_performance_package(
                performance_package,
                self.payer.pubkey(),
                self.payer.pubkey(),
                Some("Flow3: ClosePerformancePackage"),
            );
            return;
        }

        if self.trident.random_from_range(0u8..=2u8) == 0 {
            let current_authority = if self.trident.random_from_range(0u8..10u8) != 0 {
                pp.authority
            } else {
                random_authority
            };

            self.change_authority(
                performance_package,
                current_authority,
                random_authority,
                Some("Flow3: ChangeAuthority"),
            );
            return;
        }

        let proposer = if self.trident.random_from_range(0u8..=1u8) == 0 {
            if self.trident.random_from_range(0u8..10u8) != 0 {
                pp.recipient
            } else {
                random_recipient
            }
        } else if self.trident.random_from_range(0u8..10u8) != 0 {
            pp.authority
        } else {
            random_authority
        };

        let pda_nonce = self.trident.random_from_range(0u32..=u32::MAX);
        let change_request =
            get_change_request_pda_v2(&mut self.trident, performance_package, proposer, pda_nonce);

        let propose_args = match self.trident.random_from_range(0u8..=2u8) {
            0 => ProposeChangeArgs::new(pda_nonce, Some(random_recipient), None, None),
            1 => ProposeChangeArgs::new(pda_nonce, None, Some(OracleReader::Time), None),
            _ => {
                let total_amount = self.trident.random_from_range(1u64..=10_000_000u64);
                ProposeChangeArgs::new(
                    pda_nonce,
                    None,
                    None,
                    Some(RewardFunction::CliffLinear {
                        startValue: 0,
                        cliffValue: 0,
                        endValue: 1,
                        cliffAmount: 0,
                        totalAmount: total_amount,
                    }),
                )
            }
        };

        self.propose_change(
            self.payer.pubkey(),
            change_request,
            performance_package,
            proposer,
            propose_args,
            Some("Flow3: ProposeChange"),
        );

        let executor = if proposer == pp.recipient {
            pp.authority
        } else if proposer == pp.authority {
            pp.recipient
        } else {
            random_recipient
        };

        self.execute_change(
            change_request,
            performance_package,
            executor,
            self.payer.pubkey(),
            Some("Flow3: ExecuteChange"),
        );
    }
}

fn main() {
    FuzzTest::fuzz(10000, 1000);
}
