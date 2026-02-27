use fuzz_accounts::*;
use squads_multisig::client::ProposalCreateArgs;
use squads_multisig::state::SmallVec;
use squads_multisig::state::TransactionMessage;
use trident_fuzz::fuzzing::*;

#[path = "../common/mod.rs"]
pub mod common;
pub mod methods;

mod constants;
mod fuzz_accounts;

mod flows;
mod helpers;
mod invariants;

use crate::constants::*;
use common::constants::permissionless_account;
use common::types::conditional_vault;
use common::types::futarchy;
use common::types::futarchy::InitializeDaoParams;

#[derive(Default)]
struct BalanceTracking {
    base_underlying_total: u128,
    quote_underlying_total: u128,
}

/// Main fuzz test structure for conditional trading operations.
#[derive(FuzzTestMethods)]
struct FuzzTest {
    trident: Trident,
    fuzz_accounts: AccountAddresses,

    permissionless_account: Keypair,
    alice: Keypair,
    bob: Keypair,
    staker: Keypair,
    proposer: Keypair,
    initial_liquidity_provider: Keypair,
    payer: Keypair,
    dao_creator: Keypair,
    base_meta_mint_owner: Keypair,
    quote_usdc_mint_owner: Keypair,

    base_meta: Pubkey,
    quote_usdc: Pubkey,
    dao: Pubkey,
    question: Pubkey,
    base_vault: Pubkey,
    quote_vault: Pubkey,
    proposal: Pubkey,
    tracking: BalanceTracking,
}

#[flow_executor]
impl FuzzTest {
    fn new() -> Self {
        let mut trident = Trident::default();
        let permissionless_account = permissionless_account();
        let alice = trident.random_keypair();
        let bob = trident.random_keypair();
        let staker = trident.random_keypair();
        let proposer = trident.random_keypair();
        let initial_liquidity_provider = trident.random_keypair();
        let payer = trident.random_keypair();
        let dao_creator = trident.random_keypair();
        let base_meta_mint_owner = trident.random_keypair();
        let quote_usdc_mint_owner = trident.random_keypair();
        let base_meta = trident.random_keypair().pubkey();
        let quote_usdc = trident.random_keypair().pubkey();

        Self {
            trident,
            fuzz_accounts: AccountAddresses::default(),
            permissionless_account,
            alice,
            bob,
            staker,
            proposer,
            initial_liquidity_provider,
            payer,
            dao_creator,
            base_meta_mint_owner,
            quote_usdc_mint_owner,
            base_meta,
            quote_usdc,
            dao: Pubkey::default(),
            question: Pubkey::default(),
            base_vault: Pubkey::default(),
            quote_vault: Pubkey::default(),
            proposal: Pubkey::default(),
            tracking: BalanceTracking::default(),
        }
    }

    /// Initializes DAO, creates and launches a proposal, and transitions AMM to Futarchy state.
    #[init]
    fn start(&mut self) {
        self.airdrop_accounts();
        self.initial_setup();

        let init_dao_params = InitializeDaoParams::new(
            0,
            1,
            0,
            1,
            1,
            0,
            0,
            86401,
            0,
            None,
            0,
            self.dao_creator.pubkey(),
        );

        let (dao, multisig) = methods::futarchy::initialize_dao(
            &mut self.trident,
            self.payer.pubkey(),
            self.dao_creator.pubkey(),
            self.base_meta,
            self.quote_usdc,
            init_dao_params,
            Some("Initialize DAO for Conditional Trading Fuzz"),
        );
        self.dao = dao;

        methods::squads::initialize_vault_transaction(
            &mut self.trident,
            multisig,
            self.permissionless_account.pubkey(),
            self.payer.pubkey(),
            0,
            0,
            TransactionMessage {
                num_signers: 0,
                num_writable_signers: 0,
                num_writable_non_signers: 0,
                account_keys: SmallVec::from(vec![]),
                instructions: SmallVec::from(vec![]),
                address_table_lookups: SmallVec::from(vec![]),
            },
            Some("Initialize Vault Transaction"),
        );

        let squads_proposal = methods::squads::initialize_squads_proposal(
            &mut self.trident,
            multisig,
            self.permissionless_account.pubkey(),
            self.payer.pubkey(),
            ProposalCreateArgs {
                transaction_index: 1,
                draft: false,
            },
            Some("Initialize Squads Proposal"),
        );

        let oracle = methods::pda::get_proposal_pda(&mut self.trident, squads_proposal);
        let question_args = conditional_vault::InitializeQuestionArgs::new([0; 32], oracle, 2);
        self.question = methods::conditional_vault::initialize_question(
            &mut self.trident,
            self.payer.pubkey(),
            question_args,
            Some("Initialize Question"),
        );

        self.base_vault = methods::conditional_vault::initialize_conditional_vault(
            &mut self.trident,
            self.payer.pubkey(),
            self.question,
            self.base_meta,
            Some("Initialize Base Conditional Vault"),
        );
        self.quote_vault = methods::conditional_vault::initialize_conditional_vault(
            &mut self.trident,
            self.payer.pubkey(),
            self.question,
            self.quote_usdc,
            Some("Initialize Quote Conditional Vault"),
        );

        self.proposal = methods::futarchy::initialize_proposal(
            &mut self.trident,
            self.dao,
            squads_proposal,
            multisig,
            self.proposer.pubkey(),
            self.payer.pubkey(),
            self.question,
            self.base_vault,
            self.quote_vault,
            Some("Initialize Proposal"),
        );

        let proposal_base_ata = methods::token::initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            self.base_meta,
            self.proposal,
        );
        methods::futarchy::stake_to_proposal(
            &mut self.trident,
            self.dao,
            self.payer.pubkey(),
            self.proposal,
            self.staker.pubkey(),
            proposal_base_ata,
            futarchy::StakeToProposalParams::new(TEST_INITIAL_STAKE_AMOUNT),
            Some("Stake To Proposal"),
        );

        let liq_res = methods::futarchy::add_liqidity(
            &mut self.trident,
            self.dao,
            self.payer.pubkey(),
            self.initial_liquidity_provider.pubkey(),
            futarchy::ProvideLiquidityParams::new(
                TEST_INITIAL_LIQUIDITY_PROVIDER_QUOTE_INITIAL_AMOUNT,
                TEST_INITIAL_LIQUIDITY_PROVIDER_BASE_INITIAL_AMOUNT,
                0,
                self.initial_liquidity_provider.pubkey(),
            ),
            Some("Initial Spot Liquidity"),
        );
        assert!(liq_res.is_success(), "Initial liquidity seed must succeed");

        methods::futarchy::launch_proposal(
            &mut self.trident,
            multisig,
            squads_proposal,
            self.dao,
            self.payer.pubkey(),
            self.proposal,
            self.base_vault,
            self.quote_vault,
            Some("Launch Proposal"),
        );

        // Ensure setup transitioned the DAO AMM into Futarchy mode.
        let _ = self.get_futarchy_pools();
        self.capture_balance_tracking_snapshot();
    }

    #[flow]
    fn flow_conditional_swap_alice(&mut self) {
        self.conditional_swap_flow(self.alice.pubkey(), "Conditional Swap - Alice");
    }

    #[flow]
    fn flow_conditional_swap_bob(&mut self) {
        self.conditional_swap_flow(self.bob.pubkey(), "Conditional Swap - Bob");
    }

    #[end]
    fn end(&mut self) {
        self.assert_global_invariants();
    }
}

fn main() {
    FuzzTest::fuzz(FUZZ_ITERATIONS, FLOWS_PER_ITERATION);
}
