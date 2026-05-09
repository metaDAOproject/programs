use trident_fuzz::fuzzing::Signer;
use trident_fuzz::fuzzing::*;

use crate::common::pda::get_event_authority_pda;
use crate::common::token::get_or_initialize_associated_token_account;
use crate::common::types::mint_governor::MintAuthority;
use crate::common::types::mint_governor::MintGovernor;
use crate::common::types::mint_governor::{self};
use crate::constants::*;
use crate::FuzzTest;

impl FuzzTest {
    pub fn mint_governor_pda(&mut self) -> Pubkey {
        self.trident
            .find_program_address(
                &[
                    b"mint_governor",
                    self.mint.as_ref(),
                    self.create_key.pubkey().as_ref(),
                ],
                &mint_governor::program_id(),
            )
            .0
    }

    pub fn mint_authority_pda(&mut self, authorized_minter: Pubkey) -> Pubkey {
        self.trident
            .find_program_address(
                &[
                    b"mint_authority",
                    self.mint_governor.as_ref(),
                    authorized_minter.as_ref(),
                ],
                &mint_governor::program_id(),
            )
            .0
    }

    pub fn mint_governor_event_authority(&mut self) -> Pubkey {
        get_event_authority_pda(&mut self.trident, mint_governor::program_id())
    }

    pub fn read_governor(&mut self) -> MintGovernor {
        self.trident
            .get_account_with_type::<MintGovernor>(&self.mint_governor, Some(8))
            .expect("mint governor must exist")
    }

    pub fn read_mint_authority(&mut self, authorized_minter: Pubkey) -> Option<MintAuthority> {
        let mint_authority = self.mint_authority_pda(authorized_minter);
        self.trident
            .get_account_with_type::<MintAuthority>(&mint_authority, Some(8))
    }

    pub fn token_balance_for_ata(&mut self, ata: Pubkey) -> u64 {
        self.trident
            .get_token_account(ata)
            .map(|account| account.account.amount)
            .unwrap_or(0)
    }

    pub fn recipient_ata_for_owner(&mut self, owner: Pubkey) -> Pubkey {
        get_or_initialize_associated_token_account(
            &mut self.trident,
            self.payer.pubkey(),
            self.mint,
            owner,
        )
    }

    pub fn sample_limit(&mut self) -> Option<u64> {
        match self.trident.random_from_range(0u8..=3u8) {
            0 => Some(SMALL_LIMIT),
            1 => Some(LARGE_LIMIT),
            2 => Some(self.expected_total_minted),
            _ => None,
        }
    }

    pub fn valid_mint_amount(&mut self) -> Option<u64> {
        match self.expected_max_total {
            Some(limit) => {
                let remaining = limit.saturating_sub(self.expected_total_minted);
                if remaining == 0 {
                    None
                } else {
                    Some(match self.trident.random_from_range(0u8..=2u8) {
                        0 => 1,
                        1 => remaining.min(SMALL_MINT),
                        _ => remaining,
                    })
                }
            }
            None => Some(if self.trident.random_from_range(0u8..=1u8) == 0 {
                SMALL_MINT
            } else {
                LARGE_MINT
            }),
        }
    }

    pub fn invalid_mint_amount(&mut self) -> Option<u64> {
        match self.expected_max_total {
            Some(limit) => {
                let remaining = limit.saturating_sub(self.expected_total_minted);
                Some(remaining.saturating_add(1))
            }
            None => None,
        }
    }
}
