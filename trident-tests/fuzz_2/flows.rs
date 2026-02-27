use crate::common::types::futarchy;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

impl FuzzTest {
    /// Random conditional swap flow (pass/fail and buy/sell).
    pub fn conditional_swap_flow(&mut self, trader: Pubkey, label: &str) {
        let market = if self.trident.random_bool() {
            futarchy::Market::Pass
        } else {
            futarchy::Market::Fail
        };

        let swap_type = if self.trident.random_bool() {
            futarchy::SwapType::Buy
        } else {
            futarchy::SwapType::Sell
        };

        if !self.ensure_conditional_input_balance(trader, &market, &swap_type) {
            return;
        }

        let (input_mint, output_mint) = self.get_market_input_output_mints(&market, &swap_type);
        let input_balance = self.get_token_balance(input_mint, trader);

        if input_balance == 0 {
            return;
        }

        let mut input_amount: u64 = self.trident.random_log_uniform();
        input_amount = input_amount.min(input_balance);
        if input_amount == 0 {
            return;
        }

        self.conditional_swap_checked(
            trader,
            market,
            swap_type,
            input_mint,
            output_mint,
            input_amount,
            label,
        );
    }

    fn ensure_conditional_input_balance(
        &mut self,
        trader: Pubkey,
        market: &futarchy::Market,
        swap_type: &futarchy::SwapType,
    ) -> bool {
        let (input_mint, _) = self.get_market_input_output_mints(market, swap_type);
        if self.get_token_balance(input_mint, trader) > 0 {
            return true;
        }

        let (vault_to_split, underlying_mint) = match swap_type {
            futarchy::SwapType::Buy => (self.quote_vault, self.quote_usdc),
            futarchy::SwapType::Sell => (self.base_vault, self.base_meta),
        };

        let underlying_balance = self.get_token_balance(underlying_mint, trader);
        if underlying_balance == 0 {
            return false;
        }

        let mut split_amount: u64 = self.trident.random_log_uniform();
        split_amount = split_amount.min(underlying_balance);
        if split_amount == 0 {
            return false;
        }

        crate::methods::conditional_vault::split_tokens(
            &mut self.trident,
            self.payer.pubkey(),
            self.question,
            vault_to_split,
            split_amount,
            trader,
            Some("Prepare conditional input balance"),
        );

        self.get_token_balance(input_mint, trader) > 0
    }

    #[allow(clippy::too_many_arguments)]
    fn conditional_swap_checked(
        &mut self,
        trader: Pubkey,
        market: futarchy::Market,
        swap_type: futarchy::SwapType,
        input_mint: Pubkey,
        output_mint: Pubkey,
        input_amount: u64,
        label: &str,
    ) {
        let input_before = self.get_token_balance(input_mint, trader);
        let output_before = self.get_token_balance(output_mint, trader);
        let market_pool_before = self.get_market_pool(&market);

        let res = crate::methods::futarchy::conditional_swap(
            &mut self.trident,
            self.dao,
            self.payer.pubkey(),
            self.proposal,
            trader,
            self.question,
            self.base_vault,
            self.quote_vault,
            futarchy::ConditionalSwapParams::new(
                market.clone(),
                swap_type.clone(),
                input_amount,
                0,
            ),
            Some(label),
        );

        if !res.is_success() {
            return;
        }

        self.check_conditional_swap_invariants(
            trader,
            market,
            swap_type,
            input_mint,
            output_mint,
            input_before,
            output_before,
            market_pool_before,
        );
    }
}
