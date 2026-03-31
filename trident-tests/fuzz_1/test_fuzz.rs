use fuzz_accounts::*;
use trident_fuzz::fuzzing::*;

mod constants;
mod fuzz_accounts;

pub mod methods;

#[path = "../common/mod.rs"]
pub mod common;

mod flows;
mod helpers;
mod invariants;

use common::types::futarchy;
use common::types::futarchy::InitializeDaoParams;
use constants::*;

/// Main fuzz test structure for spot trading operations
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
        }
    }

    /// Initializes the test environment: airdrops, mints tokens, creates DAO, and seeds initial liquidity
    #[init]
    fn start(&mut self) {
        self.airdrop_accounts();
        self.initial_setup();

        // Initialize DAO with minimal parameters for spot trading
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
            Some("Initialize DAO for Spot Trading Fuzz"),
        );

        self.dao = dao;

        // Seed the pool with initial liquidity so trading can occur
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

    /// Flow: Alice performs a spot swap (buy or sell)
    #[flow]
    fn flow_spot_swap_alice(&mut self) {
        self.swap_flow(self.alice.pubkey(), "Spot Swap - Alice");
    }

    /// Flow: Bob performs a spot swap (buy or sell)
    #[flow]
    fn flow_spot_swap_bob(&mut self) {
        self.swap_flow(self.bob.pubkey(), "Spot Swap - Bob");
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
