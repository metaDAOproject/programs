use crate::common::types::futarchy;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

impl FuzzTest {
    pub fn capture_balance_tracking_snapshot(&mut self) {
        self.tracking.base_underlying_total = self.current_total_base_underlying();
        self.tracking.quote_underlying_total = self.current_total_quote_underlying();
    }

    fn current_total_base_underlying(&mut self) -> u128 {
        let (base_underlying_vault_ata, _) = self.get_underlying_vault_accounts();
        let owners = [
            self.dao,
            self.alice.pubkey(),
            self.bob.pubkey(),
            self.staker.pubkey(),
            self.initial_liquidity_provider.pubkey(),
            self.proposer.pubkey(),
            self.payer.pubkey(),
            self.dao_creator.pubkey(),
            self.proposal,
        ];
        owners
            .iter()
            .map(|owner| self.get_token_balance(self.base_meta, *owner) as u128)
            .sum::<u128>()
            + self.get_token_account_balance(base_underlying_vault_ata) as u128
    }

    fn current_total_quote_underlying(&mut self) -> u128 {
        let (_, quote_underlying_vault_ata) = self.get_underlying_vault_accounts();
        let owners = [
            self.dao,
            self.alice.pubkey(),
            self.bob.pubkey(),
            self.staker.pubkey(),
            self.initial_liquidity_provider.pubkey(),
            self.proposer.pubkey(),
            self.payer.pubkey(),
            self.dao_creator.pubkey(),
            self.proposal,
        ];
        owners
            .iter()
            .map(|owner| self.get_token_balance(self.quote_usdc, *owner) as u128)
            .sum::<u128>()
            + self.get_token_account_balance(quote_underlying_vault_ata) as u128
    }

    fn current_total_conditional_pair_for_owner_set(
        &mut self,
        pass_mint: Pubkey,
        fail_mint: Pubkey,
    ) -> (u128, u128) {
        let owners = [
            self.dao,
            self.alice.pubkey(),
            self.bob.pubkey(),
            self.staker.pubkey(),
            self.initial_liquidity_provider.pubkey(),
            self.proposer.pubkey(),
            self.payer.pubkey(),
            self.dao_creator.pubkey(),
            self.proposal,
        ];
        let pass_total = owners
            .iter()
            .map(|owner| self.get_token_balance(pass_mint, *owner) as u128)
            .sum();
        let fail_total = owners
            .iter()
            .map(|owner| self.get_token_balance(fail_mint, *owner) as u128)
            .sum();
        (pass_total, fail_total)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn check_conditional_swap_invariants(
        &mut self,
        trader: Pubkey,
        market: futarchy::Market,
        swap_type: futarchy::SwapType,
        input_mint: Pubkey,
        output_mint: Pubkey,
        input_before: u64,
        output_before: u64,
        market_pool_before: futarchy::Pool,
    ) {
        let input_after = self.get_token_balance(input_mint, trader);
        let output_after = self.get_token_balance(output_mint, trader);
        let market_pool_after = self.get_market_pool(&market);

        assert!(
            input_after <= input_before,
            "Trader input token balance must not increase after swap"
        );
        assert!(
            output_after >= output_before,
            "Trader output token balance must not decrease after swap"
        );

        match swap_type {
            futarchy::SwapType::Buy => {
                assert!(
                    market_pool_after.quoteReserves >= market_pool_before.quoteReserves,
                    "Buy in conditional market should increase quote reserves"
                );
                assert!(
                    market_pool_after.baseReserves <= market_pool_before.baseReserves,
                    "Buy in conditional market should decrease base reserves"
                );
            }
            futarchy::SwapType::Sell => {
                assert!(
                    market_pool_after.baseReserves >= market_pool_before.baseReserves,
                    "Sell in conditional market should increase base reserves"
                );
                assert!(
                    market_pool_after.quoteReserves <= market_pool_before.quoteReserves,
                    "Sell in conditional market should decrease quote reserves"
                );
            }
        }
    }

    pub fn assert_global_invariants(&mut self) {
        let (pass_base_mint, pass_quote_mint, fail_base_mint, fail_quote_mint) =
            self.get_conditional_mints();

        assert_eq!(
            self.current_total_base_underlying(),
            self.tracking.base_underlying_total,
            "Base underlying total should be conserved across known holders"
        );
        assert_eq!(
            self.current_total_quote_underlying(),
            self.tracking.quote_underlying_total,
            "Quote underlying total should be conserved across known holders"
        );

        let (pass_base_total, fail_base_total) =
            self.current_total_conditional_pair_for_owner_set(pass_base_mint, fail_base_mint);
        assert_eq!(
            pass_base_total, fail_base_total,
            "Pass/fail base conditional totals should remain equal over tracked owners"
        );

        let (pass_quote_total, fail_quote_total) =
            self.current_total_conditional_pair_for_owner_set(pass_quote_mint, fail_quote_mint);
        assert_eq!(
            pass_quote_total, fail_quote_total,
            "Pass/fail quote conditional totals should remain equal over tracked owners"
        );
    }
}
