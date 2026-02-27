use crate::constants::*;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

use crate::common::types::futarchy;
use crate::methods;

impl FuzzTest {
    /// Random provide_liquidity flow - selects random amounts within user's balance
    pub fn provide_flow(&mut self, provider: Pubkey, label: &str) {
        let provider_quote_balance = self.get_token_balance(self.quote_usdc, provider);
        let provider_base_balance = self.get_token_balance(self.base_meta, provider);
        if provider_quote_balance == 0 || provider_base_balance == 0 {
            return;
        }

        let (_, _, total_liquidity) = self.get_spot_reserves();

        // For empty pool, ensure minimum initial liquidity
        let quote_amount = if total_liquidity == 0 {
            MIN_INITIAL_QUOTE_LIQUIDITY.min(provider_quote_balance)
        } else {
            // Random amount up to user's balance
            provider_quote_balance.min(self.trident.random_log_uniform())
        };

        if quote_amount == 0 {
            return;
        }

        let min_liquidity = if total_liquidity == 0 { 0 } else { 1 };
        self.add_liqidity_checked(
            provider,
            quote_amount,
            provider_base_balance,
            min_liquidity,
            label,
        );
    }

    /// Random withdraw_liquidity flow - selects random amount up to user's position
    pub fn withdraw_flow(&mut self, provider: Pubkey, label: &str) {
        let provider_liquidity = self.get_position_liquidity(provider);
        if provider_liquidity == 0 {
            return;
        }

        let (_, _, total_liquidity) = self.get_spot_reserves();
        if total_liquidity == 0 {
            return;
        }

        // Random withdrawal amount up to user's position
        let liquidity_to_withdraw: u128 = self.trident.random_log_uniform();
        let liquidity_to_withdraw = liquidity_to_withdraw.min(provider_liquidity);
        self.withdraw_liquidity_checked(provider, liquidity_to_withdraw, label);
    }

    /// Provides liquidity and checks invariants on success
    fn add_liqidity_checked(
        &mut self,
        provider: Pubkey,
        quote_amount: u64,
        max_base_amount: u64,
        min_liquidity: u128,
        label: &str,
    ) {
        let base_before = self.get_token_balance(self.base_meta, provider);
        let quote_before = self.get_token_balance(self.quote_usdc, provider);
        let (base_reserve_before, quote_reserve_before, total_liquidity_before) =
            self.get_spot_reserves();
        let position_liquidity_before = self.get_position_liquidity(provider);

        let res = methods::futarchy::add_liqidity(
            &mut self.trident,
            self.dao,
            self.payer.pubkey(),
            provider,
            futarchy::ProvideLiquidityParams::new(
                quote_amount,
                max_base_amount,
                min_liquidity,
                provider,
            ),
            Some(label),
        );

        if !res.is_success() {
            return;
        }

        self.check_provide_invariants(
            provider,
            base_before,
            quote_before,
            base_reserve_before,
            quote_reserve_before,
            total_liquidity_before,
            position_liquidity_before,
        );
    }

    /// Withdraws liquidity and checks invariants on success
    fn withdraw_liquidity_checked(
        &mut self,
        provider: Pubkey,
        liquidity_to_withdraw: u128,
        label: &str,
    ) {
        let base_before = self.get_token_balance(self.base_meta, provider);
        let quote_before = self.get_token_balance(self.quote_usdc, provider);
        let (base_reserve_before, quote_reserve_before, _) = self.get_spot_reserves();

        let res = methods::futarchy::withdraw_liquidity(
            &mut self.trident,
            self.dao,
            self.payer.pubkey(),
            provider,
            futarchy::WithdrawLiquidityParams::new(liquidity_to_withdraw, 0, 0),
            Some(label),
        );

        if !res.is_success() {
            return;
        }

        self.check_withdraw_invariants(
            provider,
            base_before,
            quote_before,
            base_reserve_before,
            quote_reserve_before,
        );
    }
}
