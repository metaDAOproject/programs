use crate::common::types::futarchy;
use crate::constants::MAX_TRADE_TIME_FORWARD_SECONDS;
use crate::constants::MIN_TRADE_TIME_FORWARD_SECONDS;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

impl FuzzTest {
    fn trader_label(&self, trader: Pubkey) -> &'static str {
        if trader == self.alice.pubkey() {
            "alice"
        } else if trader == self.bob.pubkey() {
            "bob"
        } else {
            "unknown"
        }
    }

    fn swap_type_label(swap_type: &futarchy::SwapType) -> &'static str {
        match swap_type {
            futarchy::SwapType::Buy => "buy",
            futarchy::SwapType::Sell => "sell",
        }
    }

    fn market_label(market: &futarchy::Market) -> &'static str {
        match market {
            futarchy::Market::Pass => "pass",
            futarchy::Market::Fail => "fail",
            futarchy::Market::Spot => "spot",
        }
    }

    fn forward_random_trade_time(&mut self) {
        let random_time_forward_seconds = self
            .trident
            .random_from_range(MIN_TRADE_TIME_FORWARD_SECONDS..MAX_TRADE_TIME_FORWARD_SECONDS);
        self.trident.forward_in_time(random_time_forward_seconds);
    }

    /// Random spot swap flow while DAO AMM is in Futarchy state.
    pub fn spot_swap_flow(&mut self, trader: Pubkey, label: &str) {
        let (spot, _, _) = self.get_futarchy_pools();
        if spot.baseReserves == 0 || spot.quoteReserves == 0 {
            return;
        }

        let swap_type = if self.trident.random_bool() {
            futarchy::SwapType::Buy
        } else {
            futarchy::SwapType::Sell
        };

        let trader_base_balance = self.get_token_balance(self.base_meta, trader);
        let trader_quote_balance = self.get_token_balance(self.quote_usdc, trader);
        let max_input = match swap_type {
            futarchy::SwapType::Buy => trader_quote_balance.min(spot.quoteReserves),
            futarchy::SwapType::Sell => trader_base_balance.min(spot.baseReserves),
        };
        if max_input == 0 {
            return;
        }

        let mut input_amount: u64 = self.trident.random_log_uniform();
        input_amount = input_amount.min(max_input);
        if input_amount == 0 {
            return;
        }

        self.spot_swap_checked(trader, swap_type, input_amount, label);
    }

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

        let metric_name = format!(
            "fuzz_3.conditional.{}.{}.{}.input_amount",
            self.trader_label(trader),
            Self::market_label(&market),
            Self::swap_type_label(&swap_type)
        );
        self.trident
            .record_histogram(&metric_name, input_amount as f64);

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
        self.forward_random_trade_time();
    }

    fn spot_swap_checked(
        &mut self,
        trader: Pubkey,
        swap_type: futarchy::SwapType,
        input_amount: u64,
        label: &str,
    ) {
        let base_before = self.get_token_balance(self.base_meta, trader);
        let quote_before = self.get_token_balance(self.quote_usdc, trader);

        let res = crate::methods::futarchy::spot_swap(
            &mut self.trident,
            self.dao,
            trader,
            futarchy::SpotSwapParams::new(input_amount, swap_type.clone(), 0),
            Some(label),
        );
        if !res.is_success() {
            return;
        }

        let metric_name = format!(
            "fuzz_3.spot.{}.{}.input_amount",
            self.trader_label(trader),
            Self::swap_type_label(&swap_type)
        );
        self.trident
            .record_histogram(&metric_name, input_amount as f64);

        self.check_spot_swap_invariants(trader, swap_type, base_before, quote_before);
        self.forward_random_trade_time();
    }
}
