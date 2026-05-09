use crate::constants::*;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

// Re-export common modules for convenience
pub use crate::common::futarchy;
pub use crate::common::pda;
pub use crate::common::squads;
pub use crate::common::token;

impl FuzzTest {
    pub fn airdrop_accounts(&mut self) {
        self.trident
            .airdrop(&self.alice.pubkey(), TEST_AIRDROP_SOL * LAMPORTS_PER_SOL);
        self.trident
            .airdrop(&self.bob.pubkey(), TEST_AIRDROP_SOL * LAMPORTS_PER_SOL);
        self.trident
            .airdrop(&self.payer.pubkey(), TEST_AIRDROP_SOL * LAMPORTS_PER_SOL);
        self.trident.airdrop(
            &self.dao_creator.pubkey(),
            TEST_AIRDROP_SOL * LAMPORTS_PER_SOL,
        );
        self.trident.airdrop(
            &self.base_meta_mint_owner.pubkey(),
            TEST_AIRDROP_SOL * LAMPORTS_PER_SOL,
        );
        self.trident.airdrop(
            &self.quote_usdc_mint_owner.pubkey(),
            TEST_AIRDROP_SOL * LAMPORTS_PER_SOL,
        );
        self.trident.airdrop(
            &self.initial_liquidity_provider.pubkey(),
            TEST_AIRDROP_SOL * LAMPORTS_PER_SOL,
        );
    }

    pub fn initial_setup(&mut self) {
        token::initialize_mint(
            &mut self.trident,
            self.base_meta_mint_owner.pubkey(),
            self.base_meta,
            6,
            self.base_meta_mint_owner.pubkey(),
            None,
            None,
        );

        token::initialize_mint(
            &mut self.trident,
            self.quote_usdc_mint_owner.pubkey(),
            self.quote_usdc,
            6,
            self.quote_usdc_mint_owner.pubkey(),
            None,
            None,
        );

        let alice_base_ata = token::initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            self.base_meta,
            self.alice.pubkey(),
        );
        let alice_quote_ata = token::initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            self.quote_usdc,
            self.alice.pubkey(),
        );

        let bob_base_ata = token::initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            self.base_meta,
            self.bob.pubkey(),
        );
        let bob_quote_ata = token::initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            self.quote_usdc,
            self.bob.pubkey(),
        );

        let initial_liquidity_provider_base_ata = token::initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            self.base_meta,
            self.initial_liquidity_provider.pubkey(),
        );
        let initial_liquidity_provider_quote_ata = token::initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            self.quote_usdc,
            self.initial_liquidity_provider.pubkey(),
        );

        token::mint_to(
            &mut self.trident,
            alice_base_ata,
            self.base_meta,
            self.base_meta_mint_owner.pubkey(),
            TEST_BASE_INITIAL_AMOUNT,
        );
        token::mint_to(
            &mut self.trident,
            alice_quote_ata,
            self.quote_usdc,
            self.quote_usdc_mint_owner.pubkey(),
            TEST_QUOTE_INITIAL_AMOUNT,
        );

        token::mint_to(
            &mut self.trident,
            bob_base_ata,
            self.base_meta,
            self.base_meta_mint_owner.pubkey(),
            TEST_BASE_INITIAL_AMOUNT,
        );
        token::mint_to(
            &mut self.trident,
            bob_quote_ata,
            self.quote_usdc,
            self.quote_usdc_mint_owner.pubkey(),
            TEST_QUOTE_INITIAL_AMOUNT,
        );

        token::mint_to(
            &mut self.trident,
            initial_liquidity_provider_base_ata,
            self.base_meta,
            self.base_meta_mint_owner.pubkey(),
            TEST_INITIAL_LIQUIDITY_PROVIDER_BASE_INITIAL_AMOUNT,
        );
        token::mint_to(
            &mut self.trident,
            initial_liquidity_provider_quote_ata,
            self.quote_usdc,
            self.quote_usdc_mint_owner.pubkey(),
            TEST_INITIAL_LIQUIDITY_PROVIDER_QUOTE_INITIAL_AMOUNT,
        );
    }
}
