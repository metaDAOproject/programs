use fuzz_accounts::*;
use trident_fuzz::fuzzing::*;

#[path = "../common/mod.rs"]
pub mod common;
mod fuzz_accounts;
pub mod invariants;
pub mod methods;

use crate::common::constants::FEE_RECIPIENT_ID;
use crate::common::constants::TOKEN_PROGRAM_ID;
use crate::common::constants::USDC_MINT;
use crate::common::pda::get_funding_record_pda;
use crate::common::pda::get_launchpad_pda;
use crate::common::pda::get_performance_package_pda;
use crate::common::pda::get_squads_multisig_pda;
use crate::common::pda::get_squads_multisig_vault_pda;
use crate::common::token::get_or_initialize_associated_token_account;
use crate::common::token::initialize_mint;
use crate::common::types::launchpad_v_7::FundingRecord;
use crate::common::types::launchpad_v_7::Launch;
use crate::common::types::launchpad_v_7::LaunchState;

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

        let base_mint = self.fuzz_accounts.baseMint.insert(&mut self.trident, None);
        let quote_mint = USDC_MINT;
        self.fuzz_accounts.quoteMint.insert_with_address(quote_mint);

        let launch = get_launchpad_pda(&mut self.trident, base_mint);
        let launch_signer = self.initialize_launch_signer(launch);

        let launch_authority = self.trident.random_keypair();
        let wrong_authority = self.trident.random_keypair();
        self.trident
            .airdrop(&launch_authority.pubkey(), 50 * LAMPORTS_PER_SOL);
        self.trident
            .airdrop(&wrong_authority.pubkey(), 50 * LAMPORTS_PER_SOL);

        // Base mint: authority must be launch_signer PDA.
        initialize_mint(
            &mut self.trident,
            self.payer.pubkey(),
            base_mint,
            6,
            launch_signer,
            None,
            None,
        );

        initialize_mint(
            &mut self.trident,
            self.payer.pubkey(),
            quote_mint,
            6,
            self.payer.pubkey(),
            None,
            None,
        );

        // Create metadata PDA account (needed by MPL CPI).
        let token_metadata = self.initialize_token_metadata(base_mint);

        // Pre-create vault ATAs to ensure they exist for later instructions (Fund expects them).
        let quote_vault = get_or_initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            quote_mint,
            launch_signer,
        );
        let base_vault = get_or_initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            base_mint,
            launch_signer,
        );

        // Recipients / misc addresses.
        let additional_tokens_recipient = self.payer.pubkey();
        let performance_package_grantee = self.payer.pubkey();
        let team_address = self.trident.random_pubkey();

        // Initialize launch (mostly-valid, occasionally-invalid to test rejects).
        let args = self.random_initialize_launch_args(performance_package_grantee, team_address);
        self.initialize_launch(
            self.payer.pubkey(),
            launch,
            base_mint,
            quote_mint,
            token_metadata,
            launch_signer,
            quote_vault,
            base_vault,
            launch_authority.pubkey(),
            additional_tokens_recipient,
            args,
            Some("Init: InitializeLaunch"),
        );

        // Persist address pools for flows
        self.fuzz_accounts.launch.insert_with_address(launch);
        self.fuzz_accounts
            .launchSigner
            .insert_with_address(launch_signer);
        self.fuzz_accounts
            .tokenMetadata
            .insert_with_address(token_metadata);
        self.fuzz_accounts
            .launchAuthority
            .insert_with_address(launch_authority.pubkey());
        self.fuzz_accounts
            .launchAuthority
            .insert_with_address(wrong_authority.pubkey());
        self.fuzz_accounts
            .additionalTokensRecipient
            .insert_with_address(additional_tokens_recipient);

        // Funders: 2-5, each with a quote ATA seeded with a balance.
        let funder_count = 2;
        let funder_token_amount = 1_000_000_000_000; // 1M USDC
        for _ in 0..funder_count {
            let (funder, _funder_quote_account) =
                self.setup_funder_accounts(quote_mint, funder_token_amount, self.payer.pubkey());
            self.fuzz_accounts.funder.insert_with_address(funder);
            self.trident.airdrop(&funder, 10 * LAMPORTS_PER_SOL);

            // Pre-create base ATA for claims (idempotent).
            get_or_initialize_associated_token_account(
                &mut self.trident,
                self.payer.pubkey(),
                base_mint,
                funder,
            );
        }

        self.fuzz_accounts
            .feeRecipient
            .insert_with_address(FEE_RECIPIENT_ID);
    }

    #[flow]
    fn flow1_start_or_fund(&mut self) {
        let launch = self
            .fuzz_accounts
            .launch
            .get(&mut self.trident)
            .expect("launch must be set");
        let Some(launch_acc) = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
        else {
            return;
        };

        match launch_acc.state {
            LaunchState::Initialized => {
                // 99.9% correct authority, 0.1% wrong signer.
                let authority = if self.trident.random_from_range(1u16..=1000u16) != 1 {
                    launch_acc.launchAuthority
                } else {
                    self.trident.random_keypair().pubkey()
                };

                self.start_launch(launch, authority, Some("Flow1: StartLaunch"));
            }
            LaunchState::Live => {
                let funder = self
                    .fuzz_accounts
                    .funder
                    .get(&mut self.trident)
                    .expect("funder must be set");
                let other_funder = self
                    .fuzz_accounts
                    .funder
                    .get(&mut self.trident)
                    .expect("funder must be set");

                let funding_record = if self.trident.random_from_range(1u8..=100u8) != 1 {
                    get_funding_record_pda(&mut self.trident, launch, funder)
                } else {
                    // Wrong but existing PDA (most of the time)
                    get_funding_record_pda(&mut self.trident, launch, other_funder)
                };

                let correct_funder_quote_account = self.trident.get_associated_token_address(
                    &launch_acc.quoteMint,
                    &funder,
                    &TOKEN_PROGRAM_ID,
                );
                let wrong_funder_quote_account = self.trident.get_associated_token_address(
                    &launch_acc.quoteMint,
                    &other_funder,
                    &TOKEN_PROGRAM_ID,
                );

                let funder_quote_account = if self.trident.random_from_range(1u8..=100u8) != 1 {
                    correct_funder_quote_account
                } else {
                    wrong_funder_quote_account
                };

                let funder_balance = self
                    .trident
                    .get_token_account(correct_funder_quote_account)
                    .map(|acc| acc.account.amount)
                    .unwrap_or(0);
                let amount = self.random_fund_amount(funder_balance);

                self.fund(
                    self.payer.pubkey(),
                    launch,
                    funding_record,
                    launch_acc.launchSigner,
                    launch_acc.launchQuoteVault,
                    funder,
                    funder_quote_account,
                    amount,
                    Some("Flow1: Fund"),
                );

                if self
                    .trident
                    .get_account_with_type::<FundingRecord>(&funding_record, Some(8))
                    .is_some()
                {
                    self.fuzz_accounts
                        .fundingRecord
                        .insert_with_address(funding_record);
                }
            }
            _ => {
                // In other states, avoid spamming meaningless failures (but rarely still try a Fund).
                if self.trident.random_from_range(1u16..=1000u16) != 1 {
                    return;
                }
                let funder = self
                    .fuzz_accounts
                    .funder
                    .get(&mut self.trident)
                    .expect("funder must be set");
                let funder_quote_account = self.trident.get_associated_token_address(
                    &launch_acc.quoteMint,
                    &funder,
                    &TOKEN_PROGRAM_ID,
                );
                let funder_balance = self
                    .trident
                    .get_token_account(funder_quote_account)
                    .map(|acc| acc.account.amount)
                    .unwrap_or(0);
                let amount = self.random_fund_amount(funder_balance);
                let funding_record = get_funding_record_pda(&mut self.trident, launch, funder);
                self.fund(
                    self.payer.pubkey(),
                    launch,
                    funding_record,
                    launch_acc.launchSigner,
                    launch_acc.launchQuoteVault,
                    funder,
                    funder_quote_account,
                    amount,
                    Some("Flow1: Fund (state mismatch)"),
                );
            }
        }
    }

    #[flow]
    fn flow2_close_launch_and_set_funding_record_approval(&mut self) {
        let launch = self
            .fuzz_accounts
            .launch
            .get(&mut self.trident)
            .expect("launch must be set");
        let Some(launch_acc) = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
        else {
            return;
        };

        if !matches!(launch_acc.state, LaunchState::Live)
            && self.trident.random_from_range(1u8..=100u8) != 1
        {
            return;
        }

        let mostly_valid = self.trident.random_from_range(1u8..=100u8) != 1;
        // Bias toward allowing Fund to run a bit before closing, so we reach deeper states more often.
        if mostly_valid
            && matches!(launch_acc.state, LaunchState::Live)
            && launch_acc.totalCommittedAmount < launch_acc.minimumRaiseAmount
            && self.trident.random_from_range(0u8..=4u8) != 0
        {
            return;
        }
        if mostly_valid {
            if let Some(started) = launch_acc.unixTimestampStarted {
                let period_end = started.saturating_add(launch_acc.secondsForLaunch as i64);
                let now = self.trident.get_current_timestamp();
                if now < period_end {
                    self.trident.forward_in_time((period_end - now) + 1);
                }
            }
        }

        self.close_launch(launch, Some("Flow2: CloseLaunch"));

        let mut fr_acc: Option<FundingRecord> = None;
        let mut fr: Option<Pubkey> = None;
        while fr_acc.is_none() {
            fr = self.fuzz_accounts.fundingRecord.get(&mut self.trident);
            if fr.is_none() {
                return;
            }
            let fr = fr.unwrap();
            fr_acc = self
                .trident
                .get_account_with_type::<FundingRecord>(&fr, Some(8));
        }

        if fr_acc.is_none() {
            return;
        }
        let approved_amount = fr_acc.unwrap().committedAmount;
        self.set_funding_record_approval(
            launch,
            fr.unwrap(),
            launch_acc.launchAuthority,
            approved_amount,
            Some("Flow2: SetFundingRecordApproval"),
        );
    }

    #[flow]
    fn flow3_set_funding_record_approval(&mut self) {
        let launch = self
            .fuzz_accounts
            .launch
            .get(&mut self.trident)
            .expect("launch must be set");
        let Some(launch_acc) = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
        else {
            return;
        };

        if !matches!(launch_acc.state, LaunchState::Closed)
            && self.trident.random_from_range(1u8..=100u8) != 1
        {
            return;
        }

        let funder = self
            .fuzz_accounts
            .funder
            .get(&mut self.trident)
            .expect("funder must be set");
        let fr = get_funding_record_pda(&mut self.trident, launch, funder);
        let fr_acc = self
            .trident
            .get_account_with_type::<FundingRecord>(&fr, Some(8));
        if fr_acc.is_none() {
            return;
        }
        let fr_acc = fr_acc.unwrap();

        // 99.9% correct authority, 0.1% wrong signer.
        let authority = if self.trident.random_from_range(1u16..=1000u16) != 1 {
            launch_acc.launchAuthority
        } else {
            self.fuzz_accounts
                .funder
                .get(&mut self.trident)
                .expect("funder must be set")
        };

        let approved_amount = self.random_approved_amount(fr_acc.committedAmount);
        self.set_funding_record_approval(
            launch,
            fr,
            authority,
            approved_amount,
            Some("Flow3: SetFundingRecordApproval"),
        );
    }

    #[flow]
    fn flow4_complete_launch(&mut self) {
        let launch = self
            .fuzz_accounts
            .launch
            .get(&mut self.trident)
            .expect("launch must be set");
        let Some(launch_acc) = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
        else {
            return;
        };

        if !matches!(launch_acc.state, LaunchState::Closed)
            && self.trident.random_from_range(1u8..=100u8) != 1
        {
            return;
        }

        let mostly_valid = self.trident.random_from_range(0u8..=99u8) != 0; // 99%

        let token_metadata = self
            .fuzz_accounts
            .tokenMetadata
            .get(&mut self.trident)
            .expect("tokenMetadata must be set");
        let fee_recipient = self
            .fuzz_accounts
            .feeRecipient
            .get(&mut self.trident)
            .expect("feeRecipient must be set");

        let launch_authority = if mostly_valid {
            launch_acc.launchAuthority
        } else {
            self.trident.random_keypair().pubkey()
        };

        self.complete_launch(
            launch,
            launch_authority,
            token_metadata,
            self.payer.pubkey(),
            launch_acc.launchSigner,
            launch_acc.launchQuoteVault,
            launch_acc.launchBaseVault,
            launch_acc.baseMint,
            launch_acc.quoteMint,
            fee_recipient,
            Some("Flow4: CompleteLaunch"),
        );
    }

    #[flow]
    fn flow5_refund(&mut self) {
        let launch = self
            .fuzz_accounts
            .launch
            .get(&mut self.trident)
            .expect("launch must be set");
        let Some(launch_acc) = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
        else {
            return;
        };

        if !matches!(
            launch_acc.state,
            LaunchState::Refunding | LaunchState::Complete
        ) && self.trident.random_from_range(1u8..=100u8) != 1
        {
            return;
        }

        let funder = self
            .fuzz_accounts
            .funder
            .get(&mut self.trident)
            .expect("funder must be set");
        let fr = get_funding_record_pda(&mut self.trident, launch, funder);

        let correct_funder_quote_account = self.trident.get_associated_token_address(
            &launch_acc.quoteMint,
            &funder,
            &TOKEN_PROGRAM_ID,
        );
        let other_funder = self
            .fuzz_accounts
            .funder
            .get(&mut self.trident)
            .expect("funder must be set");
        let wrong_funder_quote_account = self.trident.get_associated_token_address(
            &launch_acc.quoteMint,
            &other_funder,
            &TOKEN_PROGRAM_ID,
        );
        let funder_quote_account = if self.trident.random_from_range(1u8..=100u8) != 1 {
            correct_funder_quote_account
        } else {
            wrong_funder_quote_account
        };

        self.refund(
            launch,
            fr,
            launch_acc.launchQuoteVault,
            launch_acc.launchSigner,
            funder,
            funder_quote_account,
            Some("Flow5: Refund"),
        );
    }

    #[flow]
    fn flow6_claim(&mut self) {
        let launch = self
            .fuzz_accounts
            .launch
            .get(&mut self.trident)
            .expect("launch must be set");
        let Some(launch_acc) = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
        else {
            return;
        };

        if !matches!(launch_acc.state, LaunchState::Complete)
            && self.trident.random_from_range(1u8..=100u8) != 1
        {
            return;
        }

        let funder = self
            .fuzz_accounts
            .funder
            .get(&mut self.trident)
            .expect("funder must be set");
        let fr = get_funding_record_pda(&mut self.trident, launch, funder);

        let correct_funder_base_account = get_or_initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            launch_acc.baseMint,
            funder,
        );
        let other_funder = self
            .fuzz_accounts
            .funder
            .get(&mut self.trident)
            .expect("funder must be set");
        let wrong_funder_base_account = self.trident.get_associated_token_address(
            &launch_acc.baseMint,
            &other_funder,
            &TOKEN_PROGRAM_ID,
        );
        let funder_base_account = if self.trident.random_from_range(1u8..=100u8) != 1 {
            correct_funder_base_account
        } else {
            wrong_funder_base_account
        };

        self.claim(
            launch,
            fr,
            launch_acc.launchSigner,
            launch_acc.baseMint,
            launch_acc.launchBaseVault,
            funder,
            funder_base_account,
            Some("Flow6: Claim"),
        );
    }

    #[flow]
    fn flow7_post_complete_extras(&mut self) {
        let launch = self
            .fuzz_accounts
            .launch
            .get(&mut self.trident)
            .expect("launch must be set");
        let Some(launch_acc) = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
        else {
            return;
        };

        if !matches!(launch_acc.state, LaunchState::Complete)
            && self.trident.random_from_range(1u8..=100u8) != 1
        {
            return;
        }

        // 50/50 between "additional tokens" and "performance package" work.
        if self.trident.random_from_range(0u8..=1u8) == 0 {
            // Claim additional tokens if configured and not yet claimed.
            if launch_acc.additionalTokensAmount > 0
                && !launch_acc.additionalTokensClaimed
                && launch_acc.additionalTokensRecipient.is_some()
            {
                let recipient = launch_acc.additionalTokensRecipient.unwrap();
                let recipient_token_account = get_or_initialize_associated_token_account(
                    &mut self.trident,
                    self.payer.pubkey(),
                    launch_acc.baseMint,
                    recipient,
                );

                self.claim_additional_token_allocation(
                    launch,
                    self.payer.pubkey(),
                    launch_acc.launchSigner,
                    launch_acc.launchBaseVault,
                    launch_acc.baseMint,
                    recipient,
                    recipient_token_account,
                    Some("Flow7: ClaimAdditionalTokenAllocation"),
                );
            }
            return;
        }

        // Initialize performance package if possible.
        if !launch_acc.isPerformancePackageInitialized && launch_acc.dao.is_some() {
            let dao = launch_acc.dao.unwrap();
            let squads_multisig = get_squads_multisig_pda(&mut self.trident, dao);
            let squads_multisig_vault =
                get_squads_multisig_vault_pda(&mut self.trident, squads_multisig);
            let performance_package =
                get_performance_package_pda(&mut self.trident, launch_acc.launchSigner);
            let performance_package_token_account = get_or_initialize_associated_token_account(
                &mut self.trident,
                self.payer.pubkey(),
                launch_acc.baseMint,
                performance_package,
            );

            self.initialize_performance_package(
                launch,
                self.payer.pubkey(),
                launch_acc.launchSigner,
                launch_acc.launchBaseVault,
                launch_acc.baseMint,
                dao,
                squads_multisig,
                squads_multisig_vault,
                performance_package,
                performance_package_token_account,
                Some("Flow7: InitializePerformancePackage"),
            );
        }
    }
}

fn main() {
    FuzzTest::fuzz(10000, 100);
}
