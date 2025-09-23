use anchor_lang::prelude::*;

use crate::{FutarchyError, LP_TAKER_FEE_BPS, MAX_BPS, PROTOCOL_TAKER_FEE_BPS};
use std::cmp::Ordering;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, InitSpace)]
pub struct FutarchyAmm {
    pub state: PoolState,
    pub total_liquidity: u128,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub amm_base_vault: Pubkey,
    pub amm_quote_vault: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, InitSpace)]
pub enum PoolState {
    Spot { spot: Pool },
    Futarchy { spot: Pool, pass: Pool, fail: Pool },
}

#[derive(AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, Clone, Copy)]
pub enum Market {
    Spot,
    Pass,
    Fail,
}

impl std::fmt::Display for Market {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl PoolState {
    pub fn swap(&mut self, input_amount: u64, swap_type: SwapType, market: Market) -> Result<u64> {
        let clock = Clock::get()?;

        match self {
            PoolState::Spot { spot } => {
                require_eq!(market, Market::Spot);

                spot.update_twap(clock.unix_timestamp)?;

                spot.swap(input_amount, swap_type)
            }
            PoolState::Futarchy { spot, pass, fail } => {
                let pre_spot = spot.clone();
                let pre_pass = pass.clone();
                let pre_fail = fail.clone();

                spot.update_twap(clock.unix_timestamp)?;
                pass.update_twap(clock.unix_timestamp)?;
                fail.update_twap(clock.unix_timestamp)?;

                let spot_k = spot.k();
                let pass_k = pass.k();
                let fail_k = fail.k();

                match market {
                    Market::Spot => {
                        let spot_output = spot.swap(input_amount, swap_type)?;

                        let arbitrage_result =
                            arbitrage_after_spot_swap(spot, pass, fail, spot_output, swap_type)?;

                        match swap_type {
                            SwapType::Buy => {
                                pass.base_protocol_fee_balance += arbitrage_result.pass_profit;
                                fail.base_protocol_fee_balance += arbitrage_result.fail_profit;
                            }
                            SwapType::Sell => {
                                pass.quote_protocol_fee_balance += arbitrage_result.pass_profit;
                                fail.quote_protocol_fee_balance += arbitrage_result.fail_profit;
                            }
                        }

                        require_gte!(spot.k(), spot_k);
                        require_gte!(pass.k(), pass_k);
                        require_gte!(fail.k(), fail_k);

                        Ok(spot_output + arbitrage_result.spot_profit)
                    }
                    Market::Pass | Market::Fail => {
                        let conditional_output = match market {
                            Market::Pass => pass.swap(input_amount, swap_type)?,
                            Market::Fail => fail.swap(input_amount, swap_type)?,
                            Market::Spot => unreachable!(),
                        };

                        let arbitrage_result = arbitrage_after_conditional_swap(
                            spot,
                            pass,
                            fail,
                            conditional_output,
                            swap_type,
                            market,
                        )?;

                        // Split the spot
                        let conditional_profit = match market {
                            Market::Pass => {
                                // We split the spot so we can maximize conditional profit, so we take the other side of the split
                                // and add it to the protocol fee balance
                                match swap_type {
                                    SwapType::Buy => {
                                        fail.base_protocol_fee_balance += arbitrage_result
                                            .fail_profit
                                            + arbitrage_result.spot_profit
                                    }
                                    SwapType::Sell => {
                                        fail.quote_protocol_fee_balance += arbitrage_result
                                            .fail_profit
                                            + arbitrage_result.spot_profit
                                    }
                                }

                                arbitrage_result.pass_profit + arbitrage_result.spot_profit
                            }
                            Market::Fail => {
                                match swap_type {
                                    SwapType::Buy => {
                                        pass.base_protocol_fee_balance += arbitrage_result
                                            .pass_profit
                                            + arbitrage_result.spot_profit
                                    }
                                    SwapType::Sell => {
                                        pass.quote_protocol_fee_balance += arbitrage_result
                                            .pass_profit
                                            + arbitrage_result.spot_profit
                                    }
                                }

                                arbitrage_result.fail_profit + arbitrage_result.spot_profit
                            }
                            Market::Spot => unreachable!(),
                        };

                        require_gte!(spot.k(), spot_k);
                        require_gte!(pass.k(), pass_k);
                        require_gte!(fail.k(), fail_k);

                        fn get_total_reserves(spot: &Pool, conditional: &Pool) -> (u64, u64) {
                            let total_quote = spot.quote_reserves
                                + conditional.quote_reserves
                                + spot.quote_protocol_fee_balance
                                + conditional.quote_protocol_fee_balance;
                            let total_base = spot.base_reserves
                                + conditional.base_reserves
                                + spot.base_protocol_fee_balance
                                + conditional.base_protocol_fee_balance;
                            (total_quote, total_base)
                        }

                        let (total_pass_quote_before, total_pass_base_before) =
                            get_total_reserves(&pre_spot, &pre_pass);
                        let (total_pass_quote_after, total_pass_base_after) =
                            get_total_reserves(&spot, &pass);
                        let (total_fail_quote_before, total_fail_base_before) =
                            get_total_reserves(&pre_spot, &pre_fail);
                        let (total_fail_quote_after, total_fail_base_after) =
                            get_total_reserves(&spot, &fail);

                        // these shouldn't be triggered, but just in case
                        match (market, swap_type) {
                            (Market::Pass, SwapType::Buy) => {
                                require_eq!(
                                    total_pass_quote_after,
                                    total_pass_quote_before + input_amount,
                                    FutarchyError::InvariantViolated
                                );
                                require_eq!(
                                    total_fail_quote_after,
                                    total_fail_quote_before,
                                    FutarchyError::InvariantViolated
                                );
                                require_eq!(
                                    total_pass_base_after,
                                    total_pass_base_before
                                        - (conditional_output + conditional_profit),
                                    FutarchyError::InvariantViolated
                                );
                                require_eq!(
                                    total_fail_base_after,
                                    total_fail_base_before,
                                    FutarchyError::InvariantViolated
                                );
                            }
                            (Market::Fail, SwapType::Buy) => {
                                require_eq!(
                                    total_pass_quote_after,
                                    total_pass_quote_before,
                                    FutarchyError::InvariantViolated
                                );
                                require_eq!(
                                    total_fail_quote_after,
                                    total_fail_quote_before + input_amount,
                                    FutarchyError::InvariantViolated
                                );
                                require_eq!(
                                    total_pass_base_after,
                                    total_pass_base_before,
                                    FutarchyError::InvariantViolated
                                );
                                require_eq!(
                                    total_fail_base_after,
                                    total_fail_base_before
                                        - (conditional_output + conditional_profit),
                                    FutarchyError::InvariantViolated
                                );
                            }
                            (Market::Pass, SwapType::Sell) => {
                                require_eq!(
                                    total_pass_quote_after,
                                    total_pass_quote_before
                                        - (conditional_output + conditional_profit),
                                    FutarchyError::InvariantViolated
                                );
                                require_eq!(
                                    total_fail_quote_after,
                                    total_fail_quote_before,
                                    FutarchyError::InvariantViolated
                                );
                                require_eq!(
                                    total_pass_base_after,
                                    total_pass_base_before + input_amount,
                                    FutarchyError::InvariantViolated
                                );
                                require_eq!(
                                    total_fail_base_after,
                                    total_fail_base_before,
                                    FutarchyError::InvariantViolated
                                );
                            }
                            (Market::Fail, SwapType::Sell) => {
                                require_eq!(
                                    total_pass_quote_after,
                                    total_pass_quote_before,
                                    FutarchyError::InvariantViolated
                                );
                                require_eq!(
                                    total_fail_quote_after,
                                    total_fail_quote_before
                                        - (conditional_output + conditional_profit),
                                    FutarchyError::InvariantViolated
                                );
                                require_eq!(
                                    total_pass_base_after,
                                    total_pass_base_before,
                                    FutarchyError::InvariantViolated
                                );
                                require_eq!(
                                    total_fail_base_after,
                                    total_fail_base_before + input_amount,
                                    FutarchyError::InvariantViolated
                                );
                            }
                            (Market::Spot, _) => unreachable!(),
                        }

                        Ok(conditional_output + conditional_profit)
                    }
                }
            }
        }
    }
}

#[derive(Default, Clone, Copy, Debug, AnchorDeserialize, AnchorSerialize, InitSpace)]
pub struct TwapOracle {
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
    pub last_updated_timestamp: i64,
    pub created_at_timestamp: i64,
    /// A price is the number of quote units per base unit multiplied by 1e12.
    /// You cannot simply divide by 1e12 to get a price you can display in the UI
    /// because the base and quote decimals may be different. Instead, do:
    /// ui_price = (price * (10**(base_decimals - quote_decimals))) / 1e12
    pub last_price: u128,
    /// If we did a raw TWAP over prices, someone could push the TWAP heavily with
    /// a few extremely large outliers. So we use observations, which can only move
    /// by `max_observation_change_per_update` per update.
    pub last_observation: u128,
    /// The most that an observation can change per update.
    pub max_observation_change_per_update: u128,
    /// What the initial `latest_observation` is set to.
    pub initial_observation: u128,
    /// Number of seconds after amm.created_at_slot to start recording TWAP
    pub start_delay_seconds: u32,
}

impl TwapOracle {
    pub fn new(
        current_timestamp: i64,
        initial_observation: u128,
        max_observation_change_per_update: u128,
        start_delay_seconds: u32,
    ) -> Self {
        Self {
            created_at_timestamp: current_timestamp,
            last_updated_timestamp: current_timestamp,
            last_price: 0,
            last_observation: initial_observation,
            aggregator: 0,
            max_observation_change_per_update,
            initial_observation,
            start_delay_seconds,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, InitSpace)]
pub struct Pool {
    pub oracle: TwapOracle,
    pub quote_reserves: u64,
    pub base_reserves: u64,
    pub quote_protocol_fee_balance: u64,
    pub base_protocol_fee_balance: u64,
}

impl Pool {
    /// Updates the TWAP. Should be called before any changes to the AMM's state
    /// have been made.
    ///
    /// Returns an observation if one was recorded.
    pub fn update_twap(&mut self, current_timestamp: i64) -> Result<Option<u128>> {
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
        if current_timestamp < oracle.last_updated_timestamp + 60 {
            return Ok(None);
        }

        if self.base_reserves == 0 || self.quote_reserves == 0 {
            return Ok(None);
        }

        // we store prices as quote units / base units scaled by 1e12.
        // for example, suppose META is $100 and there's 400 USDC & 4 META in
        // this pool. USDC has 6 decimals and META has 9, so we have:
        // - 400 * 1,000,000   = 400,000,000 USDC units
        // - 4 * 1,000,000,000 = 4,000,000,000 META units (hansons)
        // so there's (400,000,000 / 4,000,000,000) or 0.1 USDC units per hanson,
        // which is 100,000,000,000 when scaled by 1e12.
        let price = (self.quote_reserves as u128 * crate::PRICE_SCALE) / self.base_reserves as u128;

        let last_observation = oracle.last_observation;

        let new_observation = if price > last_observation {
            let max_observation =
                last_observation.saturating_add(oracle.max_observation_change_per_update);

            std::cmp::min(price, max_observation)
        } else {
            let min_observation =
                last_observation.saturating_sub(oracle.max_observation_change_per_update);

            std::cmp::max(price, min_observation)
        };

        // if the start delay hasn't passed, we don't update the aggregator
        // but we still update the observation
        let twap_start_timestamp = oracle.created_at_timestamp + oracle.start_delay_seconds as i64;

        let new_aggregator = if current_timestamp <= twap_start_timestamp {
            oracle.aggregator
        } else {
            // so that we don't act as if the first update ocurred over the whole
            // pre-start delay period
            let effective_last_updated_timestamp =
                oracle.last_updated_timestamp.max(twap_start_timestamp);

            let slot_difference: u128 = (current_timestamp - effective_last_updated_timestamp)
                .try_into()
                .unwrap();

            // if this saturates, the aggregator will wrap back to 0, so this value doesn't
            // really matter. we just can't panic.
            let weighted_observation = new_observation.saturating_mul(slot_difference);

            oracle.aggregator.wrapping_add(weighted_observation)
        };

        let new_oracle = TwapOracle {
            created_at_timestamp: oracle.created_at_timestamp,
            last_updated_timestamp: current_timestamp,
            last_price: price,
            last_observation: new_observation,
            aggregator: new_aggregator,
            // these three shouldn't change
            max_observation_change_per_update: oracle.max_observation_change_per_update,
            initial_observation: oracle.initial_observation,
            start_delay_seconds: oracle.start_delay_seconds,
        };

        require_gt!(
            new_oracle.last_updated_timestamp,
            oracle.last_updated_timestamp
        );

        // assert that the new observation is between price and last observation
        match price.cmp(&oracle.last_observation) {
            Ordering::Greater => {
                require_gte!(new_observation, oracle.last_observation);
                require_gte!(price, new_observation);
            }
            Ordering::Equal => {
                require_eq!(new_observation, price);
            }
            Ordering::Less => {
                require_gte!(oracle.last_observation, new_observation);
                require_gte!(new_observation, price);
            }
        }

        *oracle = new_oracle;

        Ok(Some(new_observation))
    }

    /// Returns the time-weighted average price since market creation
    pub fn get_twap(&self) -> Result<u128> {
        let start_timestamp =
            self.oracle.created_at_timestamp + self.oracle.start_delay_seconds as i64;

        require_gt!(self.oracle.last_updated_timestamp, start_timestamp);
        let seconds_passed = (self.oracle.last_updated_timestamp - start_timestamp) as u128;

        require_neq!(seconds_passed, 0);
        require_neq!(self.oracle.aggregator, 0);

        Ok(self.oracle.aggregator / seconds_passed)
    }
}

// Buy spot to above conditional -> sell spot & buy back conditional, META profit
// Buy conditional to above spot -> sell conditional & buy back spot, META profit
// Sell spot to below conditional -> buy spot & sell back conditional, USDC profit
// Sell conditional to below spot -> buy conditional & sell back spot, USDC profit

#[derive(PartialEq, Eq, Debug, Clone, Copy, AnchorSerialize, AnchorDeserialize)]
pub enum SwapType {
    Buy,
    Sell,
}

impl Pool {
    pub fn k(&self) -> u128 {
        (self.base_reserves as u128) * (self.quote_reserves as u128)
    }

    #[cfg(test)]
    pub fn price(&self) -> f64 {
        self.quote_reserves as f64 / self.base_reserves as f64
    }

    pub fn swap(&mut self, input_amount: u64, swap_type: SwapType) -> Result<u64> {
        let input_amount_after_protocol_fee = (input_amount as u128
            * (MAX_BPS - PROTOCOL_TAKER_FEE_BPS) as u128
            / MAX_BPS as u128) as u64;
        let protocol_fee = input_amount - input_amount_after_protocol_fee;

        if swap_type == SwapType::Buy {
            self.quote_protocol_fee_balance += protocol_fee;
        } else {
            self.base_protocol_fee_balance += protocol_fee;
        }

        let k = self.k();

        let (input_reserve, output_reserve) = match swap_type {
            SwapType::Buy => (self.quote_reserves, self.base_reserves),
            SwapType::Sell => (self.base_reserves, self.quote_reserves),
        };

        // airlifted from uniswap v1:
        // https://github.com/Uniswap/v1-contracts/blob/c10c08d81d6114f694baa8bd32f555a40f6264da/contracts/uniswap_exchange.vy#L106-L111

        require_neq!(input_reserve, 0);
        require_neq!(output_reserve, 0);

        let input_amount_with_lp_fee =
            input_amount_after_protocol_fee as u128 * (MAX_BPS - LP_TAKER_FEE_BPS) as u128;

        let numerator = input_amount_with_lp_fee * output_reserve as u128;

        let denominator =
            (input_reserve as u128 * MAX_BPS as u128) + input_amount_with_lp_fee as u128;

        let output_amount = (numerator / denominator) as u64;

        match swap_type {
            SwapType::Buy => {
                self.quote_reserves += input_amount_after_protocol_fee;
                self.base_reserves -= output_amount;
            }
            SwapType::Sell => {
                self.base_reserves += input_amount_after_protocol_fee;
                self.quote_reserves -= output_amount;
            }
        }

        let new_k = self.k();

        require_gte!(new_k, k);

        Ok(output_amount)
    }

    pub fn feeless_swap(&mut self, input_amount: u64, swap_type: SwapType) -> Result<u64> {
        let k = self.k();

        let (input_reserve, output_reserve) = match swap_type {
            SwapType::Buy => (self.quote_reserves, self.base_reserves),
            SwapType::Sell => (self.base_reserves, self.quote_reserves),
        };

        // airlifted from uniswap v1:
        // https://github.com/Uniswap/v1-contracts/blob/c10c08d81d6114f694baa8bd32f555a40f6264da/contracts/uniswap_exchange.vy#L106-L111

        require_neq!(input_reserve, 0);
        require_neq!(output_reserve, 0);

        let numerator = input_amount as u128 * output_reserve as u128;

        let denominator = input_reserve as u128 + input_amount as u128;

        let output_amount = (numerator / denominator) as u64;

        match swap_type {
            SwapType::Buy => {
                self.quote_reserves += input_amount;
                self.base_reserves -= output_amount;
            }
            SwapType::Sell => {
                self.base_reserves += input_amount;
                self.quote_reserves -= output_amount;
            }
        }

        let new_k = self.k();

        require_gte!(new_k, k);

        Ok(output_amount)
    }

    pub fn simulate_swap(&self, input_amount: u64, swap_type: SwapType) -> Result<u64> {
        let mut pool = self.clone();
        pool.feeless_swap(input_amount, swap_type)
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
        ((lp_tokens as u128 * self.base_reserves as u128) / lp_total_supply as u128) as u64
    }

    /// Get the number of quote tokens withdrawable from a position
    pub fn get_quote_withdrawable(&self, lp_tokens: u64, lp_total_supply: u64) -> u64 {
        ((lp_tokens as u128 * self.quote_reserves as u128) / lp_total_supply as u128) as u64
    }
}

#[derive(PartialEq, Eq, Debug, Clone, Copy)]
pub enum Token {
    Base,
    Quote,
}

#[derive(Debug, Clone)]
pub struct ArbitrageResult {
    pub spot_profit: u64,
    pub pass_profit: u64,
    pub fail_profit: u64,
}

pub fn arbitrage_after_spot_swap(
    spot: &mut Pool,
    pass: &mut Pool,
    fail: &mut Pool,
    max_input: u64,
    swap_type: SwapType,
) -> Result<ArbitrageResult> {
    let mut best_profit = 0;
    let mut best_input_amount = 0;

    let step_size = max_input / 100;

    // If we're buying spot, we want to maximize base profit & spot is possibly above
    // conditional, so we sell spot & buy conditional. If we're selling spot, we want
    // to maximize quote profit & spot is possibly below conditional, so we buy spot &
    // sell conditional.
    let (spot_direction, conditional_direction) = match swap_type {
        SwapType::Buy => (SwapType::Sell, SwapType::Buy),
        SwapType::Sell => (SwapType::Buy, SwapType::Sell),
    };

    for i in 1..=100 {
        let input_amount = i * step_size;

        let spot_output = spot.simulate_swap(input_amount, spot_direction).unwrap();

        let pass_output = pass
            .simulate_swap(spot_output, conditional_direction)
            .unwrap();

        let fail_output = fail
            .simulate_swap(spot_output, conditional_direction)
            .unwrap();

        let conditional_output = std::cmp::min(pass_output, fail_output);

        let profit = conditional_output as i64 - input_amount as i64;

        if fail_output > pass_output {
            msg!("fail output: {}", (fail_output - pass_output));
            msg!("profit: {}", profit);
        }

        if profit > best_profit {
            best_profit = profit;
            best_input_amount = input_amount;
        } else {
            break;
        }
    }

    let final_spot_output = spot
        .feeless_swap(best_input_amount, spot_direction)
        .unwrap();

    let final_pass_output = pass
        .feeless_swap(final_spot_output, conditional_direction)
        .unwrap();

    let final_fail_output = fail
        .feeless_swap(final_spot_output, conditional_direction)
        .unwrap();

    let final_conditional_output = std::cmp::min(final_pass_output, final_fail_output);

    let (remaining_pass, remaining_fail) = if final_pass_output > final_fail_output {
        (final_pass_output - final_conditional_output, 0)
    } else {
        (0, final_fail_output - final_conditional_output)
    };

    assert!(final_conditional_output >= best_input_amount);
    assert_eq!(
        final_conditional_output - best_input_amount,
        best_profit as u64
    );

    Ok(ArbitrageResult {
        spot_profit: best_profit as u64,
        pass_profit: remaining_pass,
        fail_profit: remaining_fail,
    })
}

pub fn arbitrage_after_conditional_swap(
    spot: &mut Pool,
    pass: &mut Pool,
    fail: &mut Pool,
    max_input: u64,
    swap_type: SwapType,
    market: Market,
) -> Result<ArbitrageResult> {
    // We're selling conditional, so we want quote profit
    // assert!(post_direction == SwapType::Sell);

    // Assume for now that we're selling fail so want fUSDC profit
    let mut best_arb_profit = 0;
    let mut best_arb_input_amount = 0;

    let step_size = max_input / 100;

    // If we're buying conditional, we want to maximize base profit & spot is possibly below
    // conditional, so we sell conditional and buy spot. If we're selling conditional, we want
    // to maximize quote profit & spot is possibly above conditional, so we buy conditional and
    // sell spot.
    let (conditional_direction, spot_direction) = match swap_type {
        SwapType::Buy => (SwapType::Sell, SwapType::Buy),
        SwapType::Sell => (SwapType::Buy, SwapType::Sell),
    };

    for i in 1..=100 {
        let input_amount = i * step_size;

        // We clone these because we're doing a swap later to sell our remaining
        // and we want to use accurate reserves
        let mut temp_pass = pass.clone();
        let mut temp_fail = fail.clone();

        let pass_output = temp_pass
            .feeless_swap(input_amount, conditional_direction)
            .unwrap();
        let fail_output = temp_fail
            .feeless_swap(input_amount, conditional_direction)
            .unwrap();

        let conditional_output = std::cmp::min(pass_output, fail_output);

        let spot_output = spot
            .simulate_swap(conditional_output, spot_direction)
            .unwrap();

        let spot_profit = spot_output as i64 - input_amount as i64;

        if market == Market::Fail {
            let fail_remaining_from_step_1 = fail_output.saturating_sub(conditional_output);

            let fail_profit_from_remaining = temp_fail
                .feeless_swap(fail_remaining_from_step_1, spot_direction)
                .unwrap();

            // We can split those spot tokens, so for the purpose of profit maximization we consider
            // spot + profit from remaining
            let fail_profit_incl_spot = fail_profit_from_remaining as i64 + spot_profit;

            // msg!("{} = {} + {}", fail_profit_incl_spot, fail_profit_from_remaining, spot_profit);

            if fail_profit_incl_spot > best_arb_profit && spot_profit >= 0 {
                best_arb_profit = fail_profit_incl_spot;
                best_arb_input_amount = input_amount;
            } else {
                break;
            }
        } else if market == Market::Pass {
            let pass_remaining_from_step_1 = pass_output.saturating_sub(conditional_output);

            let pass_profit_from_remaining = temp_pass
                .feeless_swap(pass_remaining_from_step_1, spot_direction)
                .unwrap();

            let pass_profit_incl_spot = pass_profit_from_remaining as i64 + spot_profit;

            if pass_profit_incl_spot > best_arb_profit && spot_profit >= 0 {
                best_arb_profit = pass_profit_incl_spot;
                best_arb_input_amount = input_amount;
            } else {
                break;
            }
        } else {
            unreachable!()
        }
    }

    let final_pass_output = pass
        .feeless_swap(best_arb_input_amount, conditional_direction)
        .unwrap();
    let final_fail_output = fail
        .feeless_swap(best_arb_input_amount, conditional_direction)
        .unwrap();
    let final_conditional_output = std::cmp::min(final_pass_output, final_fail_output);

    let final_spot_output = spot
        .feeless_swap(final_conditional_output, spot_direction)
        .unwrap();

    let fail_profit = if final_fail_output > final_pass_output {
        let remaining_fail = final_fail_output - final_conditional_output;

        let fail_profit_from_base_remaining =
            fail.feeless_swap(remaining_fail, spot_direction).unwrap();

        fail_profit_from_base_remaining
    } else {
        0
    };

    let pass_profit = if final_pass_output > final_fail_output {
        let remaining_pass = final_pass_output - final_conditional_output;

        let pass_profit_from_base_remaining =
            pass.feeless_swap(remaining_pass, spot_direction).unwrap();

        pass_profit_from_base_remaining
    } else {
        0
    };

    assert!(final_spot_output >= best_arb_input_amount);
    let spot_profit = final_spot_output - best_arb_input_amount;

    // assert_eq!(final_spot_output - best_input_amount, best_profit as u64);

    Ok(ArbitrageResult {
        spot_profit,
        pass_profit,
        fail_profit,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base_arbitrage() {
        let mut spot = Pool {
            base_reserves: 100 * 1_000_000,
            quote_reserves: 100 * 1_000_000,
            quote_protocol_fee_balance: 0,
            base_protocol_fee_balance: 0,
            oracle: TwapOracle::new(0, 0, 0, 0),
        };

        let mut pass = Pool {
            base_reserves: 100 * 1_000_000,
            quote_reserves: 100 * 1_000_000,
            quote_protocol_fee_balance: 0,
            base_protocol_fee_balance: 0,
            oracle: TwapOracle::new(0, 0, 0, 0),
        };

        let mut fail = Pool {
            base_reserves: 100 * 1_000_000,
            quote_reserves: 100 * 1_000_000,
            quote_protocol_fee_balance: 0,
            base_protocol_fee_balance: 0,
            oracle: TwapOracle::new(0, 0, 0, 0),
        };

        // spot.swap(1 * 1_000_000, SwapType::Buy).unwrap();

        // fail.swap(1 * 1_100_000, SwapType::Sell).unwrap();

        // let result = conditional_arbitrage_after_cond(&mut spot, &mut pass, &mut fail, 1 * 1_100_000, SwapType::Sell).unwrap();

        // msg!("result: {:?}", result);

        // let spot_output = spot.swap(1 * 1_000_000, SwapType::Buy).unwrap();

        let mut state = PoolState::Futarchy { spot, pass, fail };

        let output = state
            .swap(1 * 1_000_000, SwapType::Buy, Market::Spot)
            .unwrap();

        msg!("output: {:?}", output);

        let output = state
            .swap(1 * 1_000_000, SwapType::Sell, Market::Pass)
            .unwrap();

        msg!("output: {:?}", output);

        let output = state
            .swap(1 * 1_200_000, SwapType::Sell, Market::Fail)
            .unwrap();

        msg!("output: {:?}", output);

        if let PoolState::Futarchy { spot, pass, fail } = &mut state {
            msg!("spot: {:?}, price: {:?}", spot, spot.price());

            msg!("pass: {:?}, price: {:?}", pass, pass.price());

            msg!("fail: {:?}, price: {:?}", fail, fail.price());
        }
    }
}
