use fuzz_accounts::*;
use std::collections::HashMap;
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
use common::types::futarchy;
use common::types::futarchy::InitializeDaoParams;

// Tracks cumulative deposits and withdrawals per user to detect theft bugs
#[derive(Default)]
pub struct UserTracking {
    pub base_deposited: u64,
    pub quote_deposited: u64,
    pub base_withdrawn: u64,
    pub quote_withdrawn: u64,
}

/// Main fuzz test structure for liquidity operations
#[derive(FuzzTestMethods)]
struct FuzzTest {
    trident: Trident,
    fuzz_accounts: AccountAddresses,

    alice: Keypair,
    bob: Keypair,
    initial_liquidity_provider: Keypair,
    payer: Keypair,
    dao_creator: Keypair,
    base_meta_mint_owner: Keypair,
    quote_usdc_mint_owner: Keypair,

    base_meta: Pubkey,
    quote_usdc: Pubkey,
    dao: Pubkey,

    // Track deposits and withdrawals per user (keyed by Pubkey)
    user_tracking: HashMap<Pubkey, UserTracking>,
}

#[flow_executor]
impl FuzzTest {
    fn new() -> Self {
        let mut trident = Trident::default();
        let alice = trident.random_keypair();
        let bob = trident.random_keypair();
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
            alice,
            bob,
            initial_liquidity_provider,
            payer,
            dao_creator,
            base_meta_mint_owner,
            quote_usdc_mint_owner,
            base_meta,
            quote_usdc,
            dao: Pubkey::default(),
            user_tracking: HashMap::new(),
        }
    }

    /// Initializes the test environment: airdrops, mints tokens, creates DAO, and seeds initial liquidity
    #[init]
    fn start(&mut self) {
        self.airdrop_accounts();
        self.initial_setup();

        // Initialize DAO with minimal parameters for liquidity testing
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

        let (dao, _multisig) = methods::futarchy::initialize_dao(
            &mut self.trident,
            self.payer.pubkey(),
            self.dao_creator.pubkey(),
            self.base_meta,
            self.quote_usdc,
            init_dao_params,
            Some("Initialize DAO for Liquidity Fuzz"),
        );

        self.dao = dao;

        // Seed the pool with one deterministic deposit so randomized withdraw
        // flows have a valid state to operate on.
        let res = methods::futarchy::add_liqidity(
            &mut self.trident,
            self.dao,
            self.payer.pubkey(),
            self.initial_liquidity_provider.pubkey(),
            futarchy::ProvideLiquidityParams::new(
                TEST_INITIAL_LIQUIDITY_PROVIDER_BASE_INITIAL_AMOUNT,
                TEST_INITIAL_LIQUIDITY_PROVIDER_BASE_INITIAL_AMOUNT,
                0,
                self.initial_liquidity_provider.pubkey(),
            ),
            Some("Initial Liquidity"),
        );

        invariant!(res.is_success(), "Initial liquidity seed must succeed");
    }

    /// Flow: Alice provides liquidity with random amounts
    #[flow]
    fn flow_provide_liquidity_alice(&mut self) {
        self.provide_flow(self.alice.pubkey(), "Provide Liquidity - Alice");
    }

    /// Flow: Bob provides liquidity with random amounts
    #[flow]
    fn flow_provide_liquidity_bob(&mut self) {
        self.provide_flow(self.bob.pubkey(), "Provide Liquidity - Bob");
    }

    /// Flow: Alice withdraws liquidity with random amounts
    #[flow]
    fn flow_withdraw_liquidity_alice(&mut self) {
        self.withdraw_flow(self.alice.pubkey(), "Withdraw Liquidity - Alice");
    }

    /// Flow: Bob withdraws liquidity with random amounts
    #[flow]
    fn flow_withdraw_liquidity_bob(&mut self) {
        self.withdraw_flow(self.bob.pubkey(), "Withdraw Liquidity - Bob");
    }

    /// Final check: validates all global invariants at the end of each iteration
    #[end]
    fn end(&mut self) {
        self.invariant_global_invariants();
    }
}

fn main() {
    // fuzz(iterations, flows_per_iteration)
    FuzzTest::fuzz(FUZZ_ITERATIONS, FLOWS_PER_ITERATION);
}
