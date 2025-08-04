use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct FutarchyAmm {
    pub state: PoolState,
    pub total_liquidity: u128,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub amm_base_vault: Pubkey,
    pub amm_quote_vault: Pubkey,
    pub pda_bump: u8,
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
        match self {
            PoolState::Spot { spot } => {
                require_eq!(market, Market::Spot);

                spot.swap(input_amount, swap_type)
            }
            PoolState::Futarchy { spot, pass, fail } => {
                match market {
                    Market::Spot => {
                        let spot_output = spot.swap(input_amount, swap_type)?;

                        let arbitrage_result = arbitrage_after_spot_swap(spot, pass, fail, spot_output, swap_type)?;

                        msg!("spot_output: {:?}", spot_output);
                        msg!("arbitrage_result: {:?}", arbitrage_result);

                        Ok(spot_output + arbitrage_result.spot_profit)
                    },
                    Market::Pass | Market::Fail => {
                        let conditional_output = match market {
                            Market::Pass => pass.swap(input_amount, swap_type)?,
                            Market::Fail => fail.swap(input_amount, swap_type)?,
                            Market::Spot => unreachable!()
                        };

                        let arbitrage_result = arbitrage_after_conditional_swap(spot, pass, fail, conditional_output, swap_type, market)?;

                        msg!("arbitrage_result: {:?}", arbitrage_result);

                        // Split the spot 
                        let conditional_profit = match market {
                            Market::Pass => arbitrage_result.pass_profit + arbitrage_result.spot_profit,
                            Market::Fail => arbitrage_result.fail_profit + arbitrage_result.spot_profit,
                            Market::Spot => unreachable!()
                        };
                        
                        Ok(conditional_output + conditional_profit)
                    },
                }
            }
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, InitSpace)]
pub struct Pool {
    pub quote_reserves: u64,
    pub base_reserves: u64,
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

    pub fn price(&self) -> f64 {
        self.quote_reserves as f64 / self.base_reserves as f64
    }

    pub fn swap(&mut self, input_amount: u64, swap_type: SwapType) -> Result<u64> {
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
        pool.swap(input_amount, swap_type)
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

        let pass_output = pass.simulate_swap(spot_output, conditional_direction).unwrap();

        let fail_output = fail.simulate_swap(spot_output, conditional_direction).unwrap();


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

    let final_spot_output = spot.swap(best_input_amount, spot_direction).unwrap();

    let final_pass_output = pass.swap(final_spot_output, conditional_direction).unwrap();

    let final_fail_output = fail.swap(final_spot_output, conditional_direction).unwrap();

    let final_conditional_output = std::cmp::min(final_pass_output, final_fail_output);

    let (remaining_pass, remaining_fail) = if final_pass_output > final_fail_output {
        (final_pass_output - final_conditional_output, 0)
    } else {
        (0, final_fail_output - final_conditional_output)
    };

    assert!(final_conditional_output >= best_input_amount);
    assert_eq!(final_conditional_output - best_input_amount, best_profit as u64);

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

        let pass_output = temp_pass.swap(input_amount, conditional_direction).unwrap();
        let fail_output = temp_fail.swap(input_amount, conditional_direction).unwrap();

        let conditional_output = std::cmp::min(pass_output, fail_output);

        let spot_output = spot.simulate_swap(conditional_output, spot_direction).unwrap();

        let spot_profit = spot_output as i64 - input_amount as i64;

        if market == Market::Fail {
            let fail_remaining_from_step_1 = fail_output.saturating_sub(conditional_output);

            let fail_profit_from_remaining = temp_fail.swap(fail_remaining_from_step_1, spot_direction).unwrap();

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

            let pass_profit_from_remaining = temp_pass.swap(pass_remaining_from_step_1, spot_direction).unwrap();

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

    let final_pass_output = pass.swap(best_arb_input_amount, conditional_direction).unwrap();
    let final_fail_output = fail.swap(best_arb_input_amount, conditional_direction).unwrap();
    let final_conditional_output = std::cmp::min(final_pass_output, final_fail_output);

    let final_spot_output = spot.swap(final_conditional_output, spot_direction).unwrap();

    let fail_profit = if final_fail_output > final_pass_output {
        let remaining_fail = final_fail_output - final_conditional_output;

        let fail_profit_from_base_remaining = fail.swap(remaining_fail, spot_direction).unwrap();

        fail_profit_from_base_remaining
    } else {
        0
    };

    let pass_profit = if final_pass_output > final_fail_output {
        let remaining_pass = final_pass_output - final_conditional_output;

        let pass_profit_from_base_remaining = pass.swap(remaining_pass, spot_direction).unwrap();

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
        };

        let mut pass = Pool { 
            base_reserves: 100 * 1_000_000,
            quote_reserves: 100 * 1_000_000,
        };

        let mut fail = Pool {
            base_reserves: 100 * 1_000_000,
            quote_reserves: 100 * 1_000_000,
        };

        // spot.swap(1 * 1_000_000, SwapType::Buy).unwrap();

        // fail.swap(1 * 1_100_000, SwapType::Sell).unwrap();

        // let result = conditional_arbitrage_after_cond(&mut spot, &mut pass, &mut fail, 1 * 1_100_000, SwapType::Sell).unwrap();

        // msg!("result: {:?}", result);



        // let spot_output = spot.swap(1 * 1_000_000, SwapType::Buy).unwrap();

        let mut state = PoolState::Futarchy { spot, pass, fail };

        let output = state.swap(1 * 1_000_000, SwapType::Buy, Market::Spot).unwrap();

        msg!("output: {:?}", output);

        let output = state.swap(1 * 1_000_000, SwapType::Sell, Market::Pass).unwrap();

        msg!("output: {:?}", output);

        let output = state.swap(1 * 1_200_000, SwapType::Sell, Market::Fail).unwrap();

        msg!("output: {:?}", output);

        if let PoolState::Futarchy { spot, pass, fail } = &mut state {
            msg!("spot: {:?}, price: {:?}", spot, spot.price());

            msg!("pass: {:?}, price: {:?}", pass, pass.price());

            msg!("fail: {:?}, price: {:?}", fail, fail.price());
        }
    }
}