use crate::FuzzTest;
use trident_fuzz::fuzzing::Signer;

impl FuzzTest {
    pub fn manage_minter_flow(&mut self, message: &str) {
        if !self.minter_exists {
            let admin = if self.trident.random_from_range(0u8..=9u8) == 0 {
                self.fake_admin.pubkey()
            } else {
                self.payer.pubkey()
            };
            let max_total = self.sample_limit();

            if self.add_mint_authority(
                admin,
                self.authorized_minter.pubkey(),
                max_total,
                Some(message),
            ) {
                self.minter_exists = true;
                self.expected_max_total = max_total;
                self.expected_total_minted = 0;
            }
            return;
        }

        if self.trident.random_from_range(0u8..=9u8) < 7 {
            let admin = if self.trident.random_from_range(0u8..=9u8) == 0 {
                self.fake_admin.pubkey()
            } else {
                self.payer.pubkey()
            };
            let max_total = self.sample_limit();

            if self.update_mint_authority(
                admin,
                self.authorized_minter.pubkey(),
                max_total,
                Some(message),
            ) {
                self.expected_max_total = max_total;
            }
        } else {
            let admin = if self.trident.random_from_range(0u8..=9u8) == 0 {
                self.fake_admin.pubkey()
            } else {
                self.payer.pubkey()
            };

            if self.remove_mint_authority(
                admin,
                self.authorized_minter.pubkey(),
                self.payer.pubkey(),
                Some(message),
            ) {
                self.minter_exists = false;
                self.expected_max_total = None;
                self.expected_total_minted = 0;
            }
        }
    }

    pub fn mint_flow(&mut self, message: &str) {
        if !self.minter_exists {
            return;
        }

        let use_valid_signer = self.trident.random_from_range(0u8..=9u8) != 0;
        let signer = if use_valid_signer {
            self.authorized_minter.pubkey()
        } else {
            self.fake_minter.pubkey()
        };

        let amount = if use_valid_signer {
            if self.trident.random_from_range(0u8..=9u8) < 7 {
                match self.valid_mint_amount() {
                    Some(amount) => amount,
                    None => return,
                }
            } else {
                match self.invalid_mint_amount() {
                    Some(amount) => amount,
                    None => match self.valid_mint_amount() {
                        Some(amount) => amount,
                        None => return,
                    },
                }
            }
        } else {
            match self.valid_mint_amount() {
                Some(amount) => amount,
                None => return,
            }
        };

        if self.mint_tokens(
            self.authorized_minter.pubkey(),
            signer,
            self.recipient_ata,
            amount,
            Some(message),
        ) {
            self.expected_total_minted = self.expected_total_minted.saturating_add(amount);
        }
    }
}
