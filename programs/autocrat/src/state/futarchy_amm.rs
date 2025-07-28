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

pub struct Pool {
    pub base_reserves: f64,
    pub quote_reserves: f64,
}

pub enum SwapType {
    Buy,
    Sell,
}

impl Pool {
    pub fn k(&self) -> f64 {
        self.base_reserves * self.quote_reserves
    }

    pub fn swap(&mut self, input_amount: f64, swap_type: SwapType) -> Result<f64> {
        let k = self.k();

        let (input_reserve, output_reserve) = match swap_type {
            SwapType::Buy => (self.quote_reserves, self.base_reserves),
            SwapType::Sell => (self.base_reserves, self.quote_reserves),
        };

        // airlifted from uniswap v1:
        // https://github.com/Uniswap/v1-contracts/blob/c10c08d81d6114f694baa8bd32f555a40f6264da/contracts/uniswap_exchange.vy#L106-L111

        require_neq!(input_reserve, 0.0);
        require_neq!(output_reserve, 0.0);

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

        // require_gte!(new_k, k);

        Ok(output_amount)
    }
}

/// Compute the optimal arbitrage Δx* for two constant‑product AMMs using f64:
/// 
/// Δx* = (√(x_M · x_H · y_M · y_H) – x_M · y_H) / (y_M + y_H)
///
/// # Arguments
/// * `x_m` – reserve X of the “cheap” pool M (> 0.0)
/// * `y_m` – reserve Y of pool M (> 0.0)
/// * `x_h` – reserve X of the “rich” pool H (> 0.0)
/// * `y_h` – reserve Y of pool H (> 0.0)
///
/// # Returns
/// * Δx* as an f64. Positive → swap into M first; negative → swap into H first.
///
/// # Panics
/// Panics if any reserve is non‑positive or if `y_m + y_h == 0.0`.
pub fn arbitrage_delta_x_f64(x_m: f64, y_m: f64, x_h: f64, y_h: f64) -> f64 {
    assert!(x_m > 0.0 && y_m > 0.0 && x_h > 0.0 && y_h > 0.0,
        "All reserves must be positive");
    let denom = y_m + y_h;
    assert!(denom != 0.0, "Denominator y_m + y_h must not be zero");

    // Compute the geometric term and numerator
    let sqrt_term = (x_m * x_h * y_m * y_h).sqrt();
    let numerator = sqrt_term - (x_m * y_h);

    numerator / denom
}


pub fn delta_base_to_sell_overpriced(
    a_base: f64, a_quote: f64,
    b_base: f64, b_quote: f64,
) -> Option<(usize, f64)> {
    assert!(a_base > 0.0 && a_quote > 0.0 && b_base > 0.0 && b_quote > 0.0);

    let p_a = a_quote / a_base;
    let p_b = b_quote / b_base;

    let eps = 1e-15;
    if (p_a - p_b).abs() <= eps {
        return None; // no arb
    }

    // Identify overpriced (H) and underpriced (L) pools and remember which index to sell into.
    let (bh, qh, bl, ql, sell_idx) = if p_a > p_b {
        (a_base, a_quote, b_base, b_quote, 0usize)
    } else {
        (b_base, b_quote, a_base, a_quote, 1usize)
    };

    let s = (bh * bl * qh * ql).sqrt();
    let delta_sell = (s - bh * ql) / (qh + ql);

    if delta_sell > 0.0 { Some((sell_idx, delta_sell)) } else { None }
}

pub fn base_arbitrage(
    a_base: u64, a_quote: u64,
    b_base: u64, b_quote: u64,
) -> Option<(usize, u64)> {
    assert!(a_base > 0 && a_quote > 0 && b_base > 0 && b_quote > 0);

    let a_base = &IBig::from(a_base);
    let a_quote = &IBig::from(a_quote);
    let b_base = &IBig::from(b_base);
    let b_quote = &IBig::from(b_quote);

    let scaling_factor = &IBig::from(10).pow(18);

    let p_a = &(a_quote * scaling_factor / a_base);
    let p_b = &(b_quote * scaling_factor / b_base); 

    println!("p_a: {:?}", p_a);
    println!("p_b: {:?}", p_b);

    if (p_a - p_b).abs() <= IBig::from(0) {
        return None; // no arb
    }

    // Identify overpriced (H) and underpriced (L) pools and remember which index to sell into.
    let (bh, qh, bl, ql, sell_idx) = if p_a > p_b {
        (a_base, a_quote, b_base, b_quote, 0usize)
    } else {
        (b_base, b_quote, a_base, a_quote, 1usize)
    };

    let s = (bh * bl * qh * ql).sqrt();
    let delta_sell = (s - bh * ql) / (qh + ql);

    if delta_sell > IBig::from(0) { Some((sell_idx, delta_sell.try_into().unwrap() )) } else { None }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base_arbitrage() {
        let (idx, delta_base) = base_arbitrage(50, 200, 100, 100).unwrap();
        assert_eq!(idx, 0);
        assert_eq!(delta_base, 100);
    }

    #[test]
    fn test_pool_initialization() {
        let mut spot = Pool {
            base_reserves: 100.0,
            quote_reserves: 100.0,
        };

        let mut pass = Pool { 
            base_reserves: 100.0,
            quote_reserves: 100.0,
        };

        let mut fail = Pool {
            base_reserves: 100.0,
            quote_reserves: 100.0,
        };

        let output = spot.swap(1.0, SwapType::Buy).unwrap();

        println!("output: {:?}", output);


        let (idx, delta_base) = delta_base_to_sell_overpriced(spot.base_reserves, spot.quote_reserves, pass.base_reserves, pass.quote_reserves).unwrap();

        println!("idx: {:?}", idx);


        println!("delta_base: {:?}", delta_base);

        let spot_output = spot.swap(delta_base.abs(), SwapType::Sell).unwrap();

        println!("spot_output: {:?}", spot_output);

        let pass_output = pass.swap(spot_output, SwapType::Buy).unwrap();

        println!("pass_output: {:?}", pass_output);

        let profit = pass_output - delta_base.abs();

        println!("profit: {:?}", profit);

        let total_output = output + profit;

        println!("total_output: {:?}", total_output);





       


        // println!("output: {:?}", output);

        let print_reserves = || {
            println!("spot: {} USDC, {} META", spot.quote_reserves, spot.base_reserves);
            println!("pass: {} USDC, {} META", pass.quote_reserves, pass.base_reserves);
            println!("fail: {} USDC, {} META", fail.quote_reserves, fail.base_reserves);
        };

        print_reserves();


        
        // assert_eq!(pool.base_reserves, 99.0);
        // assert_eq!(pool.quote_reserves, 101.0);
    }
}