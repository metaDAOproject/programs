use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

use crate::common::constants::*;
use crate::common::types::futarchy;

impl FuzzTest {
    /// Gets token balance for a given mint and owner.
    pub fn get_token_balance(&mut self, mint: Pubkey, owner: Pubkey) -> u64 {
        let ata = self
            .trident
            .get_associated_token_address(&mint, &owner, &TOKEN_PROGRAM_ID);

        match self.trident.get_token_account(ata) {
            Ok(account) => account.account.amount,
            Err(_) => 0,
        }
    }

    /// Returns spot/pass/fail pools from the DAO in Futarchy mode.
    pub fn get_futarchy_pools(&mut self) -> (futarchy::Pool, futarchy::Pool, futarchy::Pool) {
        let dao_data = self
            .trident
            .get_account_with_type::<futarchy::Dao>(&self.dao, None)
            .expect("Dao not found");

        match dao_data.amm.state {
            futarchy::PoolState::Futarchy { spot, pass, fail } => (spot, pass, fail),
            futarchy::PoolState::Spot { .. } => {
                panic!("Conditional trading fuzz expects DAO AMM to be in Futarchy state")
            }
        }
    }

    /// Gets proposal conditional token mints (pass base/quote, fail base/quote).
    pub fn get_conditional_mints(&mut self) -> (Pubkey, Pubkey, Pubkey, Pubkey) {
        let proposal_data = self
            .trident
            .get_account_with_type::<futarchy::Proposal>(&self.proposal, None)
            .expect("Proposal not found");

        (
            proposal_data.passBaseMint,
            proposal_data.passQuoteMint,
            proposal_data.failBaseMint,
            proposal_data.failQuoteMint,
        )
    }

    pub fn get_market_pool(&mut self, market: &futarchy::Market) -> futarchy::Pool {
        let (_, pass, fail) = self.get_futarchy_pools();
        match market {
            futarchy::Market::Pass => pass,
            futarchy::Market::Fail => fail,
            futarchy::Market::Spot => panic!("Conditional trading fuzz only supports pass/fail"),
        }
    }

    pub fn get_market_input_output_mints(
        &mut self,
        market: &futarchy::Market,
        swap_type: &futarchy::SwapType,
    ) -> (Pubkey, Pubkey) {
        let (pass_base_mint, pass_quote_mint, fail_base_mint, fail_quote_mint) =
            self.get_conditional_mints();

        match (market, swap_type) {
            (futarchy::Market::Pass, futarchy::SwapType::Buy) => (pass_quote_mint, pass_base_mint),
            (futarchy::Market::Pass, futarchy::SwapType::Sell) => (pass_base_mint, pass_quote_mint),
            (futarchy::Market::Fail, futarchy::SwapType::Buy) => (fail_quote_mint, fail_base_mint),
            (futarchy::Market::Fail, futarchy::SwapType::Sell) => (fail_base_mint, fail_quote_mint),
            (futarchy::Market::Spot, _) => {
                panic!("Conditional trading fuzz only supports pass/fail")
            }
        }
    }

    pub fn get_token_account_balance(&mut self, token_account: Pubkey) -> u64 {
        match self.trident.get_token_account(token_account) {
            Ok(account) => account.account.amount,
            Err(_) => 0,
        }
    }

    pub fn get_underlying_vault_accounts(&mut self) -> (Pubkey, Pubkey) {
        let base_vault_data = self
            .trident
            .get_account_with_type::<crate::common::types::conditional_vault::ConditionalVault>(
                &self.base_vault,
                None,
            )
            .expect("Base conditional vault not found");
        let quote_vault_data = self
            .trident
            .get_account_with_type::<crate::common::types::conditional_vault::ConditionalVault>(
                &self.quote_vault,
                None,
            )
            .expect("Quote conditional vault not found");
        (
            base_vault_data.underlyingTokenAccount,
            quote_vault_data.underlyingTokenAccount,
        )
    }
}
