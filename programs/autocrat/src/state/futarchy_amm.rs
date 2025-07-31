use anchor_lang::prelude::*;
use dashu_int::{IBig, ops::{SquareRoot, Abs}};

pub struct FutarchyAmm {
    pub spot: Pool,
    pub active_proposal: Option<ProposalPricing>
}

pub struct ProposalPricing {
    pub pass: Pool,
    pub fail: Pool,
}

#[derive(Debug, Clone)]
pub struct Pool {
    pub quote_reserves: u64,
    pub base_reserves: u64,
}


// Buy spot to above conditional -> sell spot & buy back conditional, META profit
// Buy conditional to above spot -> sell conditional & buy back spot, META profit
// Sell spot to below conditional -> buy spot & sell back conditional, USDC profit
// Sell conditional to below spot -> buy conditional & sell back spot, USDC profit

pub enum SwapType {
    Buy,
    Sell,
}

impl Pool {
    pub fn k(&self) -> u64 {
        self.base_reserves * self.quote_reserves
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

        let numerator = input_amount * output_reserve;

        let denominator = input_reserve + input_amount;

        let output_amount = numerator / denominator;

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

pub fn conditional_arbitrage(
    spot: &mut Pool,
    pass: &mut Pool,
    fail: &mut Pool,
    max_input: u64,
) -> Result<u64> {
    // For now, assume that the spot pool is overpriced and we're selling spot
    // and buying back conditional
    let mut best_profit = 0;
    let mut best_input_amount = 0;

    let step_size = max_input / 100;

    for i in 1..=100 {
        let input_amount = i * step_size;

        let spot_output = spot.simulate_swap(input_amount, SwapType::Sell).unwrap();

        let pass_output = pass.simulate_swap(spot_output, SwapType::Buy).unwrap();

        let fail_output = fail.simulate_swap(spot_output, SwapType::Buy).unwrap();

        let conditional_output = std::cmp::min(pass_output, fail_output);

        let profit = conditional_output as i64 - input_amount as i64;

        if profit > best_profit {
            best_profit = profit;
            best_input_amount = input_amount;
        } else {
            break;
        }
    }

    let final_spot_output = spot.swap(best_input_amount, SwapType::Sell).unwrap();

    let final_pass_output = pass.swap(final_spot_output, SwapType::Buy).unwrap();

    let final_fail_output = fail.swap(final_spot_output, SwapType::Buy).unwrap();

    let final_conditional_output = std::cmp::min(final_pass_output, final_fail_output);

    assert!(final_conditional_output > best_input_amount);
    assert_eq!(final_conditional_output - best_input_amount, best_profit as u64);

    Ok(best_profit as u64)
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
            base_reserves: 31 * 1_000_000,
            quote_reserves: 30 * 1_000_000,
        };

        fail.swap(1 * 100_000, SwapType::Sell).unwrap();

        let spot_output = spot.swap(1 * 1_000_000, SwapType::Buy).unwrap();

        let profit = conditional_arbitrage(&mut spot, &mut pass, &mut fail, spot_output).unwrap();

        msg!("profit: {:?}", profit);

        msg!("total output: {:?}", spot_output + profit);

        msg!("spot: {:?}, price: {:?}", spot, spot.price());

        msg!("pass: {:?}, price: {:?}", pass, pass.price());

        msg!("fail: {:?}, price: {:?}", fail, fail.price());
    }
}