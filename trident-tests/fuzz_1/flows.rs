use crate::common::types::futarchy;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

impl FuzzTest {
    /// Random spot swap flow - selects random swap type and amount
    pub fn swap_flow(&mut self, trader: Pubkey, label: &str) {
        let trader_base_balance = self.get_token_balance(self.base_meta, trader);
        let trader_quote_balance = self.get_token_balance(self.quote_usdc, trader);
        let (base_reserves, quote_reserves, _, _, _) = self.get_spot_reserves();

        // Need liquidity in pool to trade
        if base_reserves == 0 || quote_reserves == 0 {
            return;
        }

        // Randomly choose buy or sell
        let swap_type = if self.trident.random_bool() {
            futarchy::SwapType::Buy
        } else {
            futarchy::SwapType::Sell
        };

        let (input_amount, has_balance) = match swap_type {
            futarchy::SwapType::Buy => {
                // Buying base with quote - need quote balance
                let max_input = trader_quote_balance.min(quote_reserves);
                if max_input == 0 {
                    return;
                }
                let input: u64 = self.trident.random_log_uniform();
                let input = input.min(max_input);
                (input, input > 0)
            }
            futarchy::SwapType::Sell => {
                // Selling base for quote - need base balance
                let max_input = trader_base_balance.min(base_reserves);
                if max_input == 0 {
                    return;
                }
                let input: u64 = self.trident.random_log_uniform();
                let input = input.min(max_input);
                (input, input > 0)
            }
        };

        if !has_balance {
            return;
        }

        self.spot_swap_checked(trader, swap_type, input_amount, label);
    }

    /// Executes spot swap and checks invariants on success
    fn spot_swap_checked(
        &mut self,
        trader: Pubkey,
        swap_type: futarchy::SwapType,
        input_amount: u64,
        label: &str,
    ) {
        let base_before = self.get_token_balance(self.base_meta, trader);
        let quote_before = self.get_token_balance(self.quote_usdc, trader);
        let (base_reserve_before, quote_reserve_before, _, _, _) = self.get_spot_reserves();

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

        self.check_swap_invariants(
            trader,
            swap_type,
            base_before,
            quote_before,
            base_reserve_before,
            quote_reserve_before,
        );
    }
}
