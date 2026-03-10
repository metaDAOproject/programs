use trident_fuzz::fuzzing::Signer;
use trident_fuzz::fuzzing::*;

use crate::common::constants::SOLANA_PROGRAM_ID;
use crate::common::constants::TOKEN_PROGRAM_ID;
use crate::common::types::mint_governor;
use crate::common::types::mint_governor::AddMintAuthorityArgs;
use crate::common::types::mint_governor::AddMintAuthorityInstruction;
use crate::common::types::mint_governor::AddMintAuthorityInstructionAccounts;
use crate::common::types::mint_governor::AddMintAuthorityInstructionData;
use crate::common::types::mint_governor::InitializeMintGovernorInstruction;
use crate::common::types::mint_governor::InitializeMintGovernorInstructionAccounts;
use crate::common::types::mint_governor::InitializeMintGovernorInstructionData;
use crate::common::types::mint_governor::MintTokensArgs;
use crate::common::types::mint_governor::MintTokensInstruction;
use crate::common::types::mint_governor::MintTokensInstructionAccounts;
use crate::common::types::mint_governor::MintTokensInstructionData;
use crate::common::types::mint_governor::RemoveMintAuthorityInstruction;
use crate::common::types::mint_governor::RemoveMintAuthorityInstructionAccounts;
use crate::common::types::mint_governor::RemoveMintAuthorityInstructionData;
use crate::common::types::mint_governor::TransferAuthorityToGovernorInstruction;
use crate::common::types::mint_governor::TransferAuthorityToGovernorInstructionAccounts;
use crate::common::types::mint_governor::TransferAuthorityToGovernorInstructionData;
use crate::common::types::mint_governor::UpdateMintAuthorityArgs;
use crate::common::types::mint_governor::UpdateMintAuthorityInstruction;
use crate::common::types::mint_governor::UpdateMintAuthorityInstructionAccounts;
use crate::common::types::mint_governor::UpdateMintAuthorityInstructionData;
use crate::FuzzTest;

impl FuzzTest {
    pub fn airdrop_accounts(&mut self) {
        for account in [
            self.payer.pubkey(),
            self.create_key.pubkey(),
            self.fake_admin.pubkey(),
            self.authorized_minter.pubkey(),
            self.fake_minter.pubkey(),
            self.recipient.pubkey(),
        ] {
            self.trident.airdrop(&account, 50 * LAMPORTS_PER_SOL);
        }
    }

    pub fn initialize_mint_governor(&mut self, message: Option<&str>) -> bool {
        let ix =
            InitializeMintGovernorInstruction::data(InitializeMintGovernorInstructionData::new())
                .accounts(InitializeMintGovernorInstructionAccounts::new(
                    self.mint,
                    self.mint_governor,
                    self.create_key.pubkey(),
                    self.payer.pubkey(),
                    self.payer.pubkey(),
                    SOLANA_PROGRAM_ID,
                    self.mint_governor_event_authority(),
                    mint_governor::program_id(),
                ))
                .instruction();

        let res = self.trident.process_transaction(&[ix], message);
        if !res.is_success() {
            return false;
        }

        let governor = self.read_governor();
        assert_eq!(governor.mint, self.mint);
        assert_eq!(governor.admin, self.payer.pubkey());
        assert_eq!(governor.createKey, self.create_key.pubkey());
        assert_eq!(governor.seqNum, 0);
        true
    }

    pub fn transfer_authority_to_governor(
        &mut self,
        current_authority: Pubkey,
        message: Option<&str>,
    ) -> bool {
        let ix = TransferAuthorityToGovernorInstruction::data(
            TransferAuthorityToGovernorInstructionData::new(),
        )
        .accounts(TransferAuthorityToGovernorInstructionAccounts::new(
            self.mint_governor,
            self.mint,
            current_authority,
            TOKEN_PROGRAM_ID,
            self.mint_governor_event_authority(),
            mint_governor::program_id(),
        ))
        .instruction();

        self.trident.process_transaction(&[ix], message).is_success()
    }

    pub fn add_mint_authority(
        &mut self,
        admin: Pubkey,
        authorized_minter: Pubkey,
        max_total: Option<u64>,
        message: Option<&str>,
    ) -> bool {
        let pre_mint_authority = self.read_mint_authority(authorized_minter);

        let ix = AddMintAuthorityInstruction::data(AddMintAuthorityInstructionData::new(
            AddMintAuthorityArgs::new(max_total),
        ))
        .accounts(AddMintAuthorityInstructionAccounts::new(
            self.mint_governor,
            self.mint_authority_pda(authorized_minter),
            admin,
            authorized_minter,
            self.payer.pubkey(),
            SOLANA_PROGRAM_ID,
            self.mint_governor_event_authority(),
            mint_governor::program_id(),
        ))
        .instruction();

        let res = self.trident.process_transaction(&[ix], message);
        let post_mint_authority = self.read_mint_authority(authorized_minter);

        if !res.is_success() {
            assert_eq!(post_mint_authority, pre_mint_authority);
            return false;
        }

        let post_mint_authority = post_mint_authority.expect("mint authority must exist");
        assert_eq!(post_mint_authority.mintGovernor, self.mint_governor);
        assert_eq!(post_mint_authority.authorizedMinter, authorized_minter);
        assert_eq!(post_mint_authority.maxTotal, max_total);
        assert_eq!(post_mint_authority.totalMinted, 0);
        true
    }

    pub fn update_mint_authority(
        &mut self,
        admin: Pubkey,
        authorized_minter: Pubkey,
        max_total: Option<u64>,
        message: Option<&str>,
    ) -> bool {
        let Some(pre_mint_authority) = self.read_mint_authority(authorized_minter) else {
            return false;
        };

        let ix = UpdateMintAuthorityInstruction::data(UpdateMintAuthorityInstructionData::new(
            UpdateMintAuthorityArgs::new(max_total),
        ))
        .accounts(UpdateMintAuthorityInstructionAccounts::new(
            self.mint_governor,
            self.mint_authority_pda(authorized_minter),
            admin,
            self.mint_governor_event_authority(),
            mint_governor::program_id(),
        ))
        .instruction();

        let res = self.trident.process_transaction(&[ix], message);
        let post_mint_authority = self
            .read_mint_authority(authorized_minter)
            .expect("mint authority should still exist");

        if !res.is_success() {
            assert_eq!(post_mint_authority, pre_mint_authority);
            return false;
        }

        assert_eq!(post_mint_authority.authorizedMinter, authorized_minter);
        assert_eq!(
            post_mint_authority.totalMinted,
            pre_mint_authority.totalMinted
        );
        assert_eq!(post_mint_authority.maxTotal, max_total);
        true
    }

    pub fn remove_mint_authority(
        &mut self,
        admin: Pubkey,
        authorized_minter: Pubkey,
        rent_destination: Pubkey,
        message: Option<&str>,
    ) -> bool {
        let Some(pre_mint_authority) = self.read_mint_authority(authorized_minter) else {
            return false;
        };

        let ix = RemoveMintAuthorityInstruction::data(RemoveMintAuthorityInstructionData::new())
            .accounts(RemoveMintAuthorityInstructionAccounts::new(
                self.mint_governor,
                self.mint_authority_pda(authorized_minter),
                admin,
                rent_destination,
                self.mint_governor_event_authority(),
                mint_governor::program_id(),
            ))
            .instruction();

        let res = self.trident.process_transaction(&[ix], message);
        let post_mint_authority = self.read_mint_authority(authorized_minter);

        if !res.is_success() {
            assert_eq!(post_mint_authority, Some(pre_mint_authority));
            return false;
        }

        assert!(post_mint_authority.is_none());
        true
    }

    pub fn mint_tokens(
        &mut self,
        mint_authority_minter: Pubkey,
        signer_minter: Pubkey,
        destination_ata: Pubkey,
        amount: u64,
        message: Option<&str>,
    ) -> bool {
        let pre_destination_amount = self.token_balance_for_ata(destination_ata);
        let pre_mint_authority = self.read_mint_authority(mint_authority_minter);

        let ix = MintTokensInstruction::data(MintTokensInstructionData::new(MintTokensArgs::new(
            amount,
        )))
        .accounts(MintTokensInstructionAccounts::new(
            self.mint_governor,
            self.mint_authority_pda(mint_authority_minter),
            self.mint,
            destination_ata,
            signer_minter,
            TOKEN_PROGRAM_ID,
            self.mint_governor_event_authority(),
            mint_governor::program_id(),
        ))
        .instruction();

        let res = self.trident.process_transaction(&[ix], message);
        let post_destination_amount = self.token_balance_for_ata(destination_ata);
        let post_mint_authority = self.read_mint_authority(mint_authority_minter);

        if !res.is_success() {
            assert_eq!(post_destination_amount, pre_destination_amount);
            assert_eq!(post_mint_authority, pre_mint_authority);
            return false;
        }

        let pre_mint_authority = pre_mint_authority.expect("mint authority must exist");
        let post_mint_authority = post_mint_authority.expect("mint authority must exist");

        assert_eq!(post_destination_amount, pre_destination_amount + amount);
        assert_eq!(
            post_mint_authority.totalMinted,
            pre_mint_authority.totalMinted + amount
        );

        if let Some(max_total) = post_mint_authority.maxTotal {
            assert!(post_mint_authority.totalMinted <= max_total);
        }

        true
    }
}
