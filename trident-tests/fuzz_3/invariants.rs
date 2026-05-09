use crate::common::types::futarchy;
use crate::constants::FINALIZE_TIME_FORWARD_SECONDS;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;
use trident_fuzz::invariant_eq;

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

        invariant!(
            input_after <= input_before,
            "Trader input token balance must not increase after swap"
        );
        invariant!(
            output_after >= output_before,
            "Trader output token balance must not decrease after swap"
        );

        match swap_type {
            futarchy::SwapType::Buy => {
                invariant!(
                    market_pool_after.quoteReserves >= market_pool_before.quoteReserves,
                    "Buy in conditional market should increase quote reserves"
                );
                invariant!(
                    market_pool_after.baseReserves <= market_pool_before.baseReserves,
                    "Buy in conditional market should decrease base reserves"
                );
            }
            futarchy::SwapType::Sell => {
                invariant!(
                    market_pool_after.baseReserves >= market_pool_before.baseReserves,
                    "Sell in conditional market should increase base reserves"
                );
                invariant!(
                    market_pool_after.quoteReserves <= market_pool_before.quoteReserves,
                    "Sell in conditional market should decrease quote reserves"
                );
            }
        }
    }

    pub fn check_spot_swap_invariants(
        &mut self,
        trader: Pubkey,
        swap_type: futarchy::SwapType,
        base_before: u64,
        quote_before: u64,
    ) {
        let base_after = self.get_token_balance(self.base_meta, trader);
        let quote_after = self.get_token_balance(self.quote_usdc, trader);

        match swap_type {
            futarchy::SwapType::Buy => {
                invariant!(
                    base_after >= base_before,
                    "Spot buy: trader base balance should increase or stay same"
                );
                invariant!(
                    quote_after <= quote_before,
                    "Spot buy: trader quote balance should decrease or stay same"
                );
            }
            futarchy::SwapType::Sell => {
                invariant!(
                    base_after <= base_before,
                    "Spot sell: trader base balance should decrease or stay same"
                );
                invariant!(
                    quote_after >= quote_before,
                    "Spot sell: trader quote balance should increase or stay same"
                );
            }
        }
    }

    pub fn invariant_global_invariants(&mut self) {
        self.invariant_futarchy_vault_alignment();

        let (pass_base_mint, pass_quote_mint, fail_base_mint, fail_quote_mint) =
            self.get_conditional_mints();

        invariant_eq!(
            self.current_total_base_underlying(),
            self.tracking.base_underlying_total,
            "Base underlying total should be conserved across known holders"
        );
        invariant_eq!(
            self.current_total_quote_underlying(),
            self.tracking.quote_underlying_total,
            "Quote underlying total should be conserved across known holders"
        );

        let (pass_base_total, fail_base_total) =
            self.current_total_conditional_pair_for_owner_set(pass_base_mint, fail_base_mint);
        invariant_eq!(
            pass_base_total,
            fail_base_total,
            "Pass/fail base conditional totals should remain equal over tracked owners"
        );

        let (pass_quote_total, fail_quote_total) =
            self.current_total_conditional_pair_for_owner_set(pass_quote_mint, fail_quote_mint);
        invariant_eq!(
            pass_quote_total,
            fail_quote_total,
            "Pass/fail quote conditional totals should remain equal over tracked owners"
        );
    }

    pub fn finalize_proposal_and_invariant_spot_alignment(&mut self) {
        let proposal_data = self
            .trident
            .get_account_with_type::<futarchy::Proposal>(&self.proposal, None)
            .expect("Proposal not found");
        if !matches!(proposal_data.state, futarchy::ProposalState::Pending) {
            return;
        }

        self.trident.forward_in_time(FINALIZE_TIME_FORWARD_SECONDS);
        self.crank_twap_for_finalize();

        let res = crate::methods::futarchy::finalize_proposal(
            &mut self.trident,
            self.dao,
            self.proposal,
            self.question,
            self.base_vault,
            self.quote_vault,
            Some("Finalize Proposal"),
        );
        invariant!(
            res.is_success(),
            "Finalize proposal must succeed,failed: {}",
            res.logs()
        );

        let proposal_data = self
            .trident
            .get_account_with_type::<futarchy::Proposal>(&self.proposal, None)
            .expect("Proposal not found after finalize");
        invariant!(
            matches!(
                proposal_data.state,
                futarchy::ProposalState::Passed | futarchy::ProposalState::Failed
            ),
            "Proposal should be finalized to Passed or Failed"
        );

        let dao_data = self
            .trident
            .get_account_with_type::<futarchy::Dao>(&self.dao, None)
            .expect("Dao not found after finalize");
        let futarchy::PoolState::Spot { spot } = dao_data.amm.state else {
            panic!("DAO AMM must transition to Spot after finalization");
        };

        let dao_spot_base_balance = self.get_token_balance(self.base_meta, self.dao);
        let dao_spot_quote_balance = self.get_token_balance(self.quote_usdc, self.dao);

        invariant_eq!(
            spot.baseReserves as u128 + spot.baseProtocolFeeBalance as u128,
            dao_spot_base_balance as u128,
            "Post-finalize spot base vault must align with spot reserves+fees"
        );
        invariant_eq!(
            spot.quoteReserves as u128 + spot.quoteProtocolFeeBalance as u128,
            dao_spot_quote_balance as u128,
            "Post-finalize spot quote vault must align with spot reserves+fees"
        );
    }

    fn invariant_futarchy_vault_alignment(&mut self) {
        let (spot, pass, fail) = self.get_futarchy_pools();

        let (pass_base_mint, pass_quote_mint, fail_base_mint, fail_quote_mint) =
            self.get_conditional_mints();

        let dao_spot_base_balance = self.get_token_balance(self.base_meta, self.dao) as u128;
        let dao_spot_quote_balance = self.get_token_balance(self.quote_usdc, self.dao) as u128;
        let dao_pass_base_balance = self.get_token_balance(pass_base_mint, self.dao) as u128;
        let dao_pass_quote_balance = self.get_token_balance(pass_quote_mint, self.dao) as u128;
        let dao_fail_base_balance = self.get_token_balance(fail_base_mint, self.dao) as u128;
        let dao_fail_quote_balance = self.get_token_balance(fail_quote_mint, self.dao) as u128;

        let spot_base_state = spot.baseReserves as u128 + spot.baseProtocolFeeBalance as u128;
        let spot_quote_state = spot.quoteReserves as u128 + spot.quoteProtocolFeeBalance as u128;
        let pass_base_state = pass.baseReserves as u128 + pass.baseProtocolFeeBalance as u128;
        let pass_quote_state = pass.quoteReserves as u128 + pass.quoteProtocolFeeBalance as u128;
        let fail_base_state = fail.baseReserves as u128 + fail.baseProtocolFeeBalance as u128;
        let fail_quote_state = fail.quoteReserves as u128 + fail.quoteProtocolFeeBalance as u128;

        // In Futarchy mode, spot underlying can move together with pass/fail legs through
        // split/merge mechanics, so we validate alignment on aggregated leg pairs.
        invariant_eq!(
            spot_base_state + pass_base_state,
            dao_spot_base_balance + dao_pass_base_balance,
            "Vault/reserve mismatch for spot+pass base leg"
        );
        invariant_eq!(
            spot_base_state + fail_base_state,
            dao_spot_base_balance + dao_fail_base_balance,
            "Vault/reserve mismatch for spot+fail base leg"
        );
        invariant_eq!(
            spot_quote_state + pass_quote_state,
            dao_spot_quote_balance + dao_pass_quote_balance,
            "Vault/reserve mismatch for spot+pass quote leg"
        );
        invariant_eq!(
            spot_quote_state + fail_quote_state,
            dao_spot_quote_balance + dao_fail_quote_balance,
            "Vault/reserve mismatch for spot+fail quote leg"
        );
    }

    fn crank_twap_for_finalize(&mut self) {
        let (spot, _, _) = self.get_futarchy_pools();
        if spot.baseReserves == 0 || spot.quoteReserves == 0 {
            return;
        }

        for trader in [self.alice.pubkey(), self.bob.pubkey()] {
            let quote_balance = self.get_token_balance(self.quote_usdc, trader);
            if quote_balance > 0 {
                let res = crate::methods::futarchy::spot_swap(
                    &mut self.trident,
                    self.dao,
                    trader,
                    futarchy::SpotSwapParams::new(1, futarchy::SwapType::Buy, 0),
                    Some("TWAP crank before finalize"),
                );
                if res.is_success() {
                    return;
                }
            }

            let base_balance = self.get_token_balance(self.base_meta, trader);
            if base_balance > 0 {
                let res = crate::methods::futarchy::spot_swap(
                    &mut self.trident,
                    self.dao,
                    trader,
                    futarchy::SpotSwapParams::new(1, futarchy::SwapType::Sell, 0),
                    Some("TWAP crank before finalize"),
                );
                if res.is_success() {
                    return;
                }
            }
        }
    }
}
