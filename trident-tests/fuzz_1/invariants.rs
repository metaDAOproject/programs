use crate::common::types::futarchy;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

impl FuzzTest {
    /// Checks invariants after a successful spot_swap operation
    pub fn check_swap_invariants(
        &mut self,
        trader: Pubkey,
        swap_type: futarchy::SwapType,
        base_before: u64,
        quote_before: u64,
        base_reserve_before: u64,
        quote_reserve_before: u64,
    ) {
        let base_after = self.get_token_balance(self.base_meta, trader);
        let quote_after = self.get_token_balance(self.quote_usdc, trader);
        let (base_reserve_after, quote_reserve_after, _, _, _) = self.get_spot_reserves();

        match swap_type {
            futarchy::SwapType::Buy => {
                // Buying base with quote: base increases, quote decreases
                // Pool: base decreases, quote increases
                assert!(
                    base_after >= base_before,
                    "Buy swap: trader base balance should increase or stay same"
                );
                assert!(
                    quote_after <= quote_before,
                    "Buy swap: trader quote balance should decrease"
                );
                assert!(
                    base_reserve_after <= base_reserve_before,
                    "Buy swap: pool base reserves should decrease"
                );
                assert!(
                    quote_reserve_after >= quote_reserve_before,
                    "Buy swap: pool quote reserves should increase"
                );
            }
            futarchy::SwapType::Sell => {
                // Selling base for quote: base decreases, quote increases
                // Pool: base increases, quote decreases
                assert!(
                    base_after <= base_before,
                    "Sell swap: trader base balance should decrease"
                );
                assert!(
                    quote_after >= quote_before,
                    "Sell swap: trader quote balance should increase or stay same"
                );
                assert!(
                    base_reserve_after >= base_reserve_before,
                    "Sell swap: pool base reserves should increase"
                );
                assert!(
                    quote_reserve_after <= quote_reserve_before,
                    "Sell swap: pool quote reserves should decrease"
                );
            }
        }
    }

    /// Global invariants checked at the end of each iteration
    pub fn assert_global_invariants(&mut self) {
        let (base_reserves, quote_reserves, total_liquidity, base_fees, quote_fees) =
            self.get_spot_reserves();
        let dao_base_balance = self.get_token_balance(self.base_meta, self.dao);
        let dao_quote_balance = self.get_token_balance(self.quote_usdc, self.dao);

        // DAO vault balance = reserves + accumulated protocol fees
        assert_eq!(
            base_reserves + base_fees,
            dao_base_balance,
            "Base reserves + fees should match DAO vault balance. Reserves: {}, Fees: {}, Vault: {}",
            base_reserves,
            base_fees,
            dao_base_balance
        );
        assert_eq!(
            quote_reserves + quote_fees,
            dao_quote_balance,
            "Quote reserves + fees should match DAO vault balance. Reserves: {}, Fees: {}, Vault: {}",
            quote_reserves,
            quote_fees,
            dao_quote_balance
        );

        // Empty pool consistency check
        if total_liquidity == 0 {
            assert_eq!(
                base_reserves, 0,
                "If total liquidity is 0, base reserves should be 0"
            );
            assert_eq!(
                quote_reserves, 0,
                "If total liquidity is 0, quote reserves should be 0"
            );
        }
    }
}
