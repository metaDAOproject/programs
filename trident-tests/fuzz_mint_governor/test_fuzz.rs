use fuzz_accounts::*;
use trident_fuzz::fuzzing::Signer;
use trident_fuzz::fuzzing::*;

#[path = "../common/mod.rs"]
pub mod common;

mod constants;
mod flows;
mod fuzz_accounts;
mod helpers;
mod invariants;
mod methods;

use crate::common::token::initialize_mint;
use constants::*;

#[derive(FuzzTestMethods)]
pub struct FuzzTest {
    trident: Trident,
    fuzz_accounts: AccountAddresses,

    payer: Keypair,
    create_key: Keypair,
    fake_admin: Keypair,
    authorized_minter: Keypair,
    fake_minter: Keypair,
    recipient: Keypair,

    mint: Pubkey,
    mint_governor: Pubkey,
    recipient_ata: Pubkey,
    minter_exists: bool,
    expected_max_total: Option<u64>,
    expected_total_minted: u64,
}

#[flow_executor]
impl FuzzTest {
    fn new() -> Self {
        let mut trident = Trident::default();

        Self {
            payer: trident.random_keypair(),
            create_key: trident.random_keypair(),
            fake_admin: trident.random_keypair(),
            authorized_minter: trident.random_keypair(),
            fake_minter: trident.random_keypair(),
            recipient: trident.random_keypair(),
            trident,
            fuzz_accounts: AccountAddresses::default(),
            mint: Pubkey::default(),
            mint_governor: Pubkey::default(),
            recipient_ata: Pubkey::default(),
            minter_exists: false,
            expected_max_total: None,
            expected_total_minted: 0,
        }
    }

    #[init]
    fn start(&mut self) {
        self.airdrop_accounts();

        self.mint = self.trident.random_keypair().pubkey();

        initialize_mint(
            &mut self.trident,
            self.payer.pubkey(),
            self.mint,
            MINT_DECIMALS,
            self.payer.pubkey(),
            None,
            Some("Init: Mint"),
        );

        self.mint_governor = self.mint_governor_pda();
        self.recipient_ata = self.recipient_ata_for_owner(self.recipient.pubkey());

        self.minter_exists = false;
        self.expected_max_total = None;
        self.expected_total_minted = 0;

        assert!(
            self.initialize_mint_governor(Some("Init: InitializeMintGovernor")),
            "mint governor initialization must succeed",
        );
        assert!(
            self.transfer_authority_to_governor(
                self.payer.pubkey(),
                Some("Init: TransferAuthorityToGovernor"),
            ),
            "initial authority transfer must succeed",
        );

        self.assert_global_invariants();
    }

    #[flow]
    fn flow_manage_minter(&mut self) {
        self.manage_minter_flow("Flow: ManageMinter");
    }

    #[flow]
    fn flow_mint(&mut self) {
        self.mint_flow("Flow: Mint");
    }

    #[end]
    fn end(&mut self) {
        self.assert_global_invariants();
    }
}

fn main() {
    FuzzTest::fuzz(FUZZ_ITERATIONS.into(), FLOWS_PER_ITERATION.into());
}
