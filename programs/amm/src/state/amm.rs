use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Slot;

use crate::error::AmmError;
use crate::{MAX_PRICE, ONE_MINUTE_IN_SLOTS, PRICE_SCALE};
use std::cmp::{max, min, Ordering};

#[derive(Clone, Copy, Debug, AnchorSerialize, AnchorDeserialize)]
pub enum SwapType {
    /// Swap quote tokens into base tokens
    Buy,
    /// Swap base tokens into quote tokens
    Sell,
}

#[derive(Default, Clone, Copy, Debug, AnchorDeserialize, AnchorSerialize)]
pub struct TwapOracle {
    pub last_updated_slot: u64,
    /// A price is the number of quote units per base unit multiplied by 1e12.
    /// You cannot simply divide by 1e12 to get a price you can display in the UI
    /// because the base and quote decimals may be different. Instead, do:
    /// ui_price = (price * (10**(base_decimals - quote_decimals))) / 1e12
    pub last_price: u128,
    /// If we did a raw TWAP over prices, someone could push the TWAP heavily with
    /// a few extremely large outliers. So we use observations, which can only move
    /// by `max_observation_change_per_update` per update.
    pub last_observation: u128,
    /// Running sum of slots_per_last_update * last_observation.
    ///
    /// Assuming latest observations are as big as possible (u64::MAX * 1e12),
    /// we can store 18 million slots worth of observations, which turns out to
    /// be ~85 days worth of slots.
    ///
    /// Assuming that latest observations are 100x smaller than they could theoretically
    /// be, we can store 8500 days (23 years) worth of them. Even this is a very
    /// very conservative assumption - META/USDC prices should be between 1e9 and
    /// 1e15, which would overflow after 1e15 years worth of slots.
    ///
    /// So in the case of an overflow, the aggregator rolls back to 0. It's the
    /// client's responsibility to sanity check the assets or to handle an
    /// aggregator at T2 being smaller than an aggregator at T1.
    pub aggregator: u128,
    /// The most that an observation can change per update.
    pub max_observation_change_per_update: u128,
    /// What the initial `latest_observation` is set to.
    pub initial_observation: u128,
    /// Number of slots after amm.created_at_slot to start recording TWAP
    pub start_delay_slots: u64,
}

impl TwapOracle {
    pub fn new(
        current_slot: Slot,
        initial_observation: u128,
        max_observation_change_per_update: u128,
        start_delay_slots: u64,
    ) -> Self {
        Self {
            last_updated_slot: current_slot,
            last_price: 0,
            last_observation: initial_observation,
            aggregator: 0,
            max_observation_change_per_update,
            initial_observation,
            start_delay_slots,
        }
    }
}

#[account]
#[derive(Default)]
pub struct Amm {
    pub bump: u8,

    pub created_at_slot: u64,

    pub lp_mint: Pubkey,

    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,

    pub base_mint_decimals: u8,
    pub quote_mint_decimals: u8,

    pub base_amount: u64,
    pub quote_amount: u64,

    pub oracle: TwapOracle,

    pub seq_num: u64,
}

impl Amm {
    pub fn k(&self) -> u128 {
        self.base_amount as u128 * self.quote_amount as u128
    }

    /// Does the internal accounting to swap `input_amount` into the returned
    /// output amount so that output amount can be transferred to the user.
    pub fn swap(&mut self, input_amount: u64, swap_type: SwapType) -> Result<u64> {
        let base_amount_start = self.base_amount as u128;
        let quote_amount_start = self.quote_amount as u128;

        let k = self.k();

        let (input_reserve, output_reserve) = match swap_type {
            SwapType::Buy => (quote_amount_start, base_amount_start),
            SwapType::Sell => (base_amount_start, quote_amount_start),
        };

        // airlifted from uniswap v1:
        // https://github.com/Uniswap/v1-contracts/blob/c10c08d81d6114f694baa8bd32f555a40f6264da/contracts/uniswap_exchange.vy#L106-L111

        require!(input_reserve != 0, AmmError::NoReserves);
        require!(output_reserve != 0, AmmError::NoReserves);

        let input_amount_with_fee = input_amount as u128 * 99;

        let numerator = input_amount_with_fee
            .checked_mul(output_reserve)
            .ok_or(error!(AmmError::InputAmountOverflow))?;

        let denominator = (input_reserve * 100) + input_amount_with_fee;

        let output_amount = (numerator / denominator)
            .try_into()
            .map_err(|_| AmmError::CastingOverflow)?;

        match swap_type {
            SwapType::Buy => {
                self.quote_amount += input_amount;
                self.base_amount -= output_amount;
            }
            SwapType::Sell => {
                self.base_amount += input_amount;
                self.quote_amount -= output_amount;
            }
        }

        let new_k = self.k();

        require_gte!(new_k, k, AmmError::ConstantProductInvariantFailed);

        Ok(output_amount)
    }

    /// Get the number of base and quote tokens withdrawable from a position
    pub fn get_base_and_quote_withdrawable(
        &self,
        lp_tokens: u64,
        lp_total_supply: u64,
    ) -> (u64, u64) {
        (
            self.get_base_withdrawable(lp_tokens, lp_total_supply),
            self.get_quote_withdrawable(lp_tokens, lp_total_supply),
        )
    }

    /// Get the number of base tokens withdrawable from a position
    pub fn get_base_withdrawable(&self, lp_tokens: u64, lp_total_supply: u64) -> u64 {
        // must fit back into u64 since `lp_tokens` <= `lp_total_supply`
        ((lp_tokens as u128 * self.base_amount as u128) / lp_total_supply as u128) as u64
    }

    /// Get the number of quote tokens withdrawable from a position
    pub fn get_quote_withdrawable(&self, lp_tokens: u64, lp_total_supply: u64) -> u64 {
        ((lp_tokens as u128 * self.quote_amount as u128) / lp_total_supply as u128) as u64
    }

    /// Returns the time-weighted average price since market creation
    pub fn get_twap(&self) -> Result<u128> {
        let start_slot = self.created_at_slot + self.oracle.start_delay_slots;

        require_gt!(
            self.oracle.last_updated_slot,
            start_slot,
            AmmError::NoSlotsPassed
        );
        let slots_passed = (self.oracle.last_updated_slot - start_slot) as u128;

        require_neq!(slots_passed, 0, AmmError::NoSlotsPassed);
        require!(self.oracle.aggregator != 0, AmmError::AssertFailed);

        Ok(self.oracle.aggregator / slots_passed)
    }

    /// Updates the TWAP. Should be called before any changes to the AMM's state
    /// have been made.
    ///
    /// Returns an observation if one was recorded.
    pub fn update_twap(&mut self, current_slot: Slot) -> Result<Option<u128>> {
        let oracle = &mut self.oracle;

        // a manipulator is likely to be "bursty" with their usage, such as a
        // validator who abuses their slots to manipulate the TWAP.
        // meanwhile, regular trading is less likely to happen in each slot.
        // suppose that in normal trading, one trade happens every 4 slots.
        // if we allow observations to move 1% per slot, a manipulator who
        // can land every slot would be able to move the last observation by 348%
        // over 1 minute (1.01^(# of slots in a minute)) whereas normal trading
        // activity would be only able to move it by 45% over 1 minute
        // (1.01^(# of slots in a minute / 4)). so it makes sense to not allow an
        // update every slot.
        //
        // on the other hand, you can't allow updates too infrequently either.
        // if you could only update once a day, a manipulator only needs to buy
        // one slot per day to drastically shift the TWAP.
        //
        // we allow updates once a minute as a happy medium. if you have an asset
        // that trades near $1500 and you allow $25 updates per minute, it can double
        // over an hour.
        if current_slot < oracle.last_updated_slot + ONE_MINUTE_IN_SLOTS {
            return Ok(None);
        }

        if self.base_amount == 0 || self.quote_amount == 0 {
            return Ok(None);
        }

        // we store prices as quote units / base units scaled by 1e12.
        // for example, suppose META is $100 and there's 400 USDC & 4 META in
        // this pool. USDC has 6 decimals and META has 9, so we have:
        // - 400 * 1,000,000   = 400,000,000 USDC units
        // - 4 * 1,000,000,000 = 4,000,000,000 META units (hansons)
        // so there's (400,000,000 / 4,000,000,000) or 0.1 USDC units per hanson,
        // which is 100,000,000,000 when scaled by 1e12.
        let price = (self.quote_amount as u128 * PRICE_SCALE) / self.base_amount as u128;

        let last_observation = oracle.last_observation;

        let new_observation = if price > last_observation {
            let max_observation =
                last_observation.saturating_add(oracle.max_observation_change_per_update);

            min(price, max_observation)
        } else {
            let min_observation =
                last_observation.saturating_sub(oracle.max_observation_change_per_update);

            max(price, min_observation)
        };

        // if the start delay hasn't passed, we don't update the aggregator
        // but we still update the observation
        let twap_start_slot = self.created_at_slot + oracle.start_delay_slots;

        let new_aggregator = if current_slot <= twap_start_slot {
            oracle.aggregator
        } else {
            // so that we don't act as if the first update ocurred over the whole
            // pre-start delay period
            let effective_last_updated_slot = oracle.last_updated_slot.max(twap_start_slot);

            let slot_difference = (current_slot - effective_last_updated_slot) as u128;

            // if this saturates, the aggregator will wrap back to 0, so this value doesn't
            // really matter. we just can't panic.
            let weighted_observation = new_observation.saturating_mul(slot_difference);

            oracle.aggregator.wrapping_add(weighted_observation)
        };

        let new_oracle = TwapOracle {
            last_updated_slot: current_slot,
            last_price: price,
            last_observation: new_observation,
            aggregator: new_aggregator,
            // these three shouldn't change
            max_observation_change_per_update: oracle.max_observation_change_per_update,
            initial_observation: oracle.initial_observation,
            start_delay_slots: oracle.start_delay_slots,
        };

        require!(
            new_oracle.last_updated_slot > oracle.last_updated_slot,
            AmmError::AssertFailed
        );
        // assert that the new observation is between price and last observation
        match price.cmp(&oracle.last_observation) {
            Ordering::Greater => {
                require!(
                    new_observation >= oracle.last_observation,
                    AmmError::AssertFailed
                );
                require!(new_observation <= price, AmmError::AssertFailed);
            }
            Ordering::Equal => {
                require!(new_observation == price, AmmError::AssertFailed);
            }
            Ordering::Less => {
                require!(
                    new_observation <= oracle.last_observation,
                    AmmError::AssertFailed
                );
                require!(new_observation >= price, AmmError::AssertFailed);
            }
        }

        *oracle = new_oracle;

        Ok(Some(new_observation))
    }

    pub fn invariant(&self) -> Result<()> {
        let oracle = &self.oracle;

        require!(oracle.last_price <= MAX_PRICE, AmmError::AssertFailed);
        require!(oracle.last_observation <= MAX_PRICE, AmmError::AssertFailed);

        Ok(())
    }
}

#[macro_export]
macro_rules! generate_amm_seeds {
    ($amm:expr) => {{
        &[
            AMM_SEED_PREFIX,
            $amm.base_mint.as_ref(),
            $amm.quote_mint.as_ref(),
            &[$amm.bump],
        ]
    }};
}

#[cfg(test)]
mod simple_amm_tests {
    use crate::{error::AmmError, state::*};
    use SwapType::{Buy, Sell};

    #[test]
    pub fn base_case_amm() {
        let mut amm = Amm { ..Amm::default() };

        let res = amm.get_twap();
        assert_eq!(res.unwrap_err(), AmmError::NoSlotsPassed.into());

        assert_eq!(amm.swap(1, Buy).unwrap_err(), AmmError::NoReserves.into());
        assert_eq!(amm.swap(1, Sell).unwrap_err(), AmmError::NoReserves.into());
        assert_eq!(amm.k(), 0);
    }

    #[test]
    pub fn smol_amm() {
        let mut amm = Amm {
            base_amount: 3,
            quote_amount: 8,
            ..Amm::default()
        };

        assert_eq!(amm.k(), 24);

        // 4 x 6 = 24, would be 2 but we take out 1 for fee
        assert_eq!(amm.swap(1, Sell).unwrap(), 1);
        assert_eq!(amm.k(), 28); // 4 x 7

        let mut amm_clone = amm.clone();
        // 2 x 14 = 28, but we take one for fee
        assert_eq!(amm.swap(7, Buy).unwrap(), 1);
        assert_eq!(amm.k(), 42); // 3 x 14

        // re-run on the clone but give an extra for fee,
        // we should now get back 2
        assert_eq!(amm_clone.swap(8, Buy).unwrap(), 2);
        assert_eq!(amm_clone.k(), 30); // 2 x 15
    }

    #[test]
    pub fn simple_twap_math_amm() {
        let mut amm = Amm {
            base_amount: 5,
            quote_amount: 50,
            oracle: TwapOracle::new(0, 1_000_000, MAX_PRICE),
            ..Amm::default()
        };

        // minute hasn't passed since last slot
        assert_eq!(amm.update_twap(1), None);
        assert_eq!(amm.oracle.last_updated_slot, 0);

        assert_eq!(amm.update_twap(ONE_MINUTE_IN_SLOTS), Some(10 * PRICE_SCALE));
    }

    #[test]
    pub fn overflow_twap() {
        let mut amm = Amm {
            base_amount: 1,
            quote_amount: u64::MAX,
            oracle: TwapOracle::new(0, MAX_PRICE, MAX_PRICE),
            ..Amm::default()
        };

        let mut amm_clone = amm.clone();

        let slots_until_overflow = u128::MAX / (u64::MAX as u128 * PRICE_SCALE);

        amm.update_twap(slots_until_overflow as u64);
        require!(amm.oracle.aggregator > MAX_PRICE * 18_400_000);
        assert_ne!(amm.oracle.aggregator, u128::MAX);

        amm_clone.update_twap(slots_until_overflow as u64 + 1);
        assert_eq!(amm_clone.oracle.aggregator, u128::MAX);

        // check that it wraps over
        amm_clone.update_twap(slots_until_overflow as u64 + 1 + ONE_MINUTE_IN_SLOTS);
        assert_eq!(
            amm_clone.oracle.aggregator,
            ONE_MINUTE_IN_SLOTS as u128 * MAX_PRICE - 1
        ); // sub 1 cuz wrap
    }
}
