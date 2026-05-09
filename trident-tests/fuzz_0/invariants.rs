use crate::constants::ROUNDING_TOLERANCE;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;
use trident_fuzz::invariant_eq;

impl FuzzTest {
    /// Checks invariants after a successful provide_liquidity operation
    #[allow(clippy::too_many_arguments)]
    pub fn check_provide_invariants(
        &mut self,
        provider: Pubkey,
        base_before: u64,
        quote_before: u64,
        base_reserve_before: u64,
        quote_reserve_before: u64,
        total_liquidity_before: u128,
        position_liquidity_before: u128,
    ) {
        let base_after = self.get_token_balance(self.base_meta, provider);
        let quote_after = self.get_token_balance(self.quote_usdc, provider);
        let (base_reserve_after, quote_reserve_after, total_liquidity_after) =
            self.get_spot_reserves();
        let position_liquidity_after = self.get_position_liquidity(provider);

        // Calculate and track actual amounts deposited
        let base_deposited = base_before.saturating_sub(base_after);
        let quote_deposited = quote_before.saturating_sub(quote_after);

        let tracking = self.get_user_tracking(provider);
        tracking.base_deposited = tracking.base_deposited.saturating_add(base_deposited);
        tracking.quote_deposited = tracking.quote_deposited.saturating_add(quote_deposited);

        // Simple invariants: balances decrease, reserves increase, liquidity increases
        invariant!(base_after <= base_before);
        invariant!(quote_after <= quote_before);
        invariant!(base_reserve_after >= base_reserve_before);
        invariant!(quote_reserve_after >= quote_reserve_before);
        invariant!(total_liquidity_after >= total_liquidity_before);
        invariant!(position_liquidity_after >= position_liquidity_before);
    }

    /// Checks invariants after a successful withdraw_liquidity operation
    pub fn check_withdraw_invariants(
        &mut self,
        provider: Pubkey,
        base_before: u64,
        quote_before: u64,
        base_reserve_before: u64,
        quote_reserve_before: u64,
    ) {
        let base_after = self.get_token_balance(self.base_meta, provider);
        let quote_after = self.get_token_balance(self.quote_usdc, provider);
        let (base_reserve_after, quote_reserve_after, _) = self.get_spot_reserves();

        // Calculate and track actual amounts withdrawn
        let base_withdrawn = base_after.saturating_sub(base_before);
        let quote_withdrawn = quote_after.saturating_sub(quote_before);

        let tracking = self.get_user_tracking(provider);
        tracking.base_withdrawn = tracking.base_withdrawn.saturating_add(base_withdrawn);
        tracking.quote_withdrawn = tracking.quote_withdrawn.saturating_add(quote_withdrawn);

        // Per-user check: withdrawn should not significantly exceed deposited.
        // A tolerance of 1 token is allowed because floor division in partial
        // withdrawals leaves rounding dust in the pool, which gets redistributed
        // to remaining LP holders. This is standard AMM behavior, not a bug.
        // Any difference > 1 would indicate a real accounting issue.
        let base_withdrawn_total = tracking.base_withdrawn;
        let base_deposited_total = tracking.base_deposited;
        let quote_withdrawn_total = tracking.quote_withdrawn;
        let quote_deposited_total = tracking.quote_deposited;

        if base_withdrawn_total > base_deposited_total.saturating_add(ROUNDING_TOLERANCE) {
            let difference = base_withdrawn_total - base_deposited_total;
            panic!(
                "User {:?} has withdrawn more base tokens ({}) than deposited ({}). Difference: {}. This exceeds rounding tolerance and indicates a theft bug!",
                provider,
                base_withdrawn_total,
                base_deposited_total,
                difference
            );
        }
        if quote_withdrawn_total > quote_deposited_total.saturating_add(ROUNDING_TOLERANCE) {
            let difference = quote_withdrawn_total - quote_deposited_total;
            panic!(
                "User {:?} has withdrawn more quote tokens ({}) than deposited ({}). Difference: {}. This exceeds rounding tolerance and indicates a theft bug!",
                provider,
                quote_withdrawn_total,
                quote_deposited_total,
                difference
            );
        }

        // Simple invariants: balances increase, reserves decrease
        invariant!(base_after >= base_before);
        invariant!(quote_after >= quote_before);
        invariant!(base_reserve_after <= base_reserve_before);
        invariant!(quote_reserve_after <= quote_reserve_before);
    }

    /// Global invariants checked at the end of each iteration
    pub fn invariant_global_invariants(&mut self) {
        let (base_reserves, quote_reserves, total_liquidity) = self.get_spot_reserves();
        let dao_base_balance = self.get_token_balance(self.base_meta, self.dao);
        let dao_quote_balance = self.get_token_balance(self.quote_usdc, self.dao);

        // Reserve accounting should match DAO vault balances
        invariant_eq!(base_reserves, dao_base_balance);
        invariant_eq!(quote_reserves, dao_quote_balance);

        // Empty pool consistency check
        if total_liquidity == 0 {
            invariant_eq!(
                base_reserves,
                0,
                "If total liquidity is 0, base reserves should be 0"
            );
            invariant_eq!(
                quote_reserves,
                0,
                "If total liquidity is 0, quote reserves should be 0"
            );
        }

        for (user_pubkey, tracking) in &self.user_tracking {
            let base_withdrawn = tracking.base_withdrawn;
            let base_deposited = tracking.base_deposited;
            let quote_withdrawn = tracking.quote_withdrawn;
            let quote_deposited = tracking.quote_deposited;

            if base_withdrawn > base_deposited.saturating_add(ROUNDING_TOLERANCE) {
                let difference = base_withdrawn - base_deposited;
                panic!(
                    "User {:?} has withdrawn more base tokens ({}) than deposited ({}). Difference: {}. This exceeds rounding tolerance and indicates a theft bug!",
                    user_pubkey,
                    base_withdrawn,
                    base_deposited,
                    difference
                );
            }
            if quote_withdrawn > quote_deposited.saturating_add(ROUNDING_TOLERANCE) {
                let difference = quote_withdrawn - quote_deposited;
                panic!(
                    "User {:?} has withdrawn more quote tokens ({}) than deposited ({}). Difference: {}. This exceeds rounding tolerance and indicates a theft bug!",
                    user_pubkey,
                    quote_withdrawn,
                    quote_deposited,
                    difference
                );
            }
        }
    }
}
