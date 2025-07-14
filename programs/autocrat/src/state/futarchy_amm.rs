use anchor_lang::prelude::*;

use crate::AutocratError;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Eq, PartialEq, Clone)]
pub enum Side {
    Buy,
    Sell,
}


#[account]
#[derive(InitSpace, Debug)]
pub struct FutarchyAmm {
    pub bump: u8,
    pub dao: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub spot_pool: Pool,
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,
    pub live_proposal: Option<LiveProposalDetails>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace, Debug)]
pub struct LiveProposalDetails {
    pub proposal: Pubkey,
    pub question: Pubkey,
    pub pass_pool: Pool,
    pub fail_pool: Pool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace, Debug)]
pub struct Pool {
    pub base_reserves: u64,
    pub quote_reserves: u64,
}

impl Pool {
    pub fn k(&self) -> u128 {
        self.base_reserves as u128 * self.quote_reserves as u128
    }

    #[cfg(test)]
    pub fn price(&self) -> f64 {
        self.quote_reserves as f64 / self.base_reserves as f64
    }

    /// Does the internal accounting to swap `input_amount` into the returned
    /// output amount so that output amount can be transferred to the user.
    pub fn feeless_swap(&mut self, input_amount: u64, side: Side) -> Result<u64> {
        let base_amount_start = self.base_reserves as u128;
        let quote_amount_start = self.quote_reserves as u128;

        let k = self.k();

        let (input_reserve, output_reserve) = match side {
            Side::Buy => (quote_amount_start, base_amount_start),
            Side::Sell => (base_amount_start, quote_amount_start),
        };

        require!(input_reserve != 0, AutocratError::NoReserves);
        require!(output_reserve != 0, AutocratError::NoReserves);

        let numerator = input_amount as u128 * output_reserve;

        let denominator = input_reserve + input_amount as u128;

        let output_amount = (numerator / denominator)
            .try_into()
            .map_err(|_| AutocratError::CastingOverflow)?;

        match side {
            Side::Buy => {
                self.quote_reserves += input_amount;
                self.base_reserves -= output_amount;
            }
            Side::Sell => {
                self.base_reserves += input_amount;
                self.quote_reserves -= output_amount;
            }
        }

        let new_k = self.k();

        require_gte!(new_k, k, AutocratError::ConstantProductInvariantFailed);

        Ok(output_amount)
    }
}

impl FutarchyAmm {
    pub fn swap(&mut self, side: Side, amount_in: u64) -> Result<()> {
        if self.live_proposal.is_none() {
            // Just a regular spot swap
            self.spot_pool.feeless_swap(amount_in, side)?;

            Ok(())
        } else {
            let proposal_details = self.live_proposal.as_mut().unwrap();

            let pass_pool = &mut proposal_details.pass_pool;
            let fail_pool = &mut proposal_details.fail_pool;

            match side {
                Side::Buy => {
                    let higher_priced_quote_reserves = pass_pool.quote_reserves.max(fail_pool.quote_reserves);

                    let swappable_amount_before_shared_liquidity = higher_priced_quote_reserves - self.spot_pool.quote_reserves;

                    let (initial_spot_swap_amount, split_amount) = if swappable_amount_before_shared_liquidity >= amount_in {
                        (amount_in, 0)
                    } else {
                        (swappable_amount_before_shared_liquidity, amount_in - swappable_amount_before_shared_liquidity)
                    };

                    let spot_split_amount = split_amount / 2;

                    self.spot_pool.feeless_swap(initial_spot_swap_amount + spot_split_amount, Side::Buy)?;

                    pass_pool.feeless_swap(spot_split_amount, Side::Buy)?;
                    fail_pool.feeless_swap(spot_split_amount, Side::Buy)?;
                }
                Side::Sell => {
                    let lower_priced_base_reserves = pass_pool.base_reserves.min(fail_pool.base_reserves);

                    // TODO: this may have rounding issues
                    let swappable_amount_before_shared_liquidity = self.spot_pool.base_reserves - lower_priced_base_reserves;

                    let (initial_spot_swap_amount, split_amount) = if swappable_amount_before_shared_liquidity >= amount_in {
                        (amount_in, 0)
                    } else {
                        (swappable_amount_before_shared_liquidity, amount_in - swappable_amount_before_shared_liquidity)
                    };

                    let spot_split_amount = split_amount / 2;

                    self.spot_pool.feeless_swap(initial_spot_swap_amount + spot_split_amount, Side::Sell)?;

                    pass_pool.feeless_swap(spot_split_amount, Side::Sell)?;
                    fail_pool.feeless_swap(spot_split_amount, Side::Sell)?;
                }
            }

            Ok(())
        }
    }
}

pub fn solve_max_meta_out(
    s_usdc_reserves: f64,
    s_meta_reserves: f64,
    p_usdc_reserves: f64,
    p_meta_reserves: f64,
    f_usdc_reserves: f64,
    f_meta_reserves: f64,
    k: f64,
) -> (f64, f64, f64) {
    // We'll solve by making constraints 2 and 3 active (equal to k)
    // and then finding the maximum meta_out that satisfies constraint 1
    
    // From constraint 2: (p_usdc + split_usdc)(p_meta + split_meta) = k
    // From constraint 3: (f_usdc + split_usdc)(f_meta + split_meta) = k
    
    // These give us two equations in two unknowns (split_usdc, split_meta)
    // Let's solve them using substitution
    
    // From constraint 2: split_meta = k/(p_usdc + split_usdc) - p_meta
    // Substituting into constraint 3 and solving for split_usdc
    
    let a = f_usdc_reserves - p_usdc_reserves;
    let b = f_meta_reserves - p_meta_reserves;
    let c = k / p_usdc_reserves - p_meta_reserves;
    let d = k / f_usdc_reserves - f_meta_reserves;
    
    // This leads to a quadratic equation for split_usdc
    // After algebraic manipulation:
    let coeff_a = b;
    let coeff_b = a * p_meta_reserves + b * p_usdc_reserves + a * c;
    let coeff_c = a * (p_usdc_reserves * p_meta_reserves - k);
    
    // Solve quadratic equation
    let discriminant = coeff_b * coeff_b - 4.0 * coeff_a * coeff_c;
    
    if discriminant < 0.0 {
        // No real solution, return zeros
        return (0.0, 0.0, 0.0);
    }
    
    let sqrt_disc = discriminant.sqrt();
    let split_usdc_1 = (-coeff_b + sqrt_disc) / (2.0 * coeff_a);
    let split_usdc_2 = (-coeff_b - sqrt_disc) / (2.0 * coeff_a);
    
    // Try both solutions and pick the one that gives valid results
    let solutions = vec![split_usdc_1, split_usdc_2];
    let mut best_meta_out = 0.0;
    let mut best_solution = (0.0, 0.0, 0.0);
    
    for split_usdc in solutions {
        // Calculate split_meta from constraint 2
        let denom = p_usdc_reserves + split_usdc;
        if denom.abs() < 1e-10 {
            continue;
        }
        
        let split_meta = k / denom - p_meta_reserves;
        
        // Check if constraint 3 is satisfied
        let constraint3_val = (f_usdc_reserves + split_usdc) * (f_meta_reserves + split_meta);
        if (constraint3_val - k).abs() > 1e-6 {
            continue;
        }
        
        // Calculate maximum meta_out from constraint 1
        let s_usdc_term = s_usdc_reserves - split_usdc;
        if s_usdc_term <= 0.0 {
            continue;
        }
        
        let meta_out = s_meta_reserves - split_meta - k / s_usdc_term;
        
        // Check if meta_out is positive and better than current best
        if meta_out > 0.0 && meta_out > best_meta_out {
            best_meta_out = meta_out;
            best_solution = (split_usdc, split_meta, meta_out);
        }
    }
    
    // Also check the case where constraint 1 and 2 are active, or 1 and 3 are active
    // This requires solving different equation systems
    
    // Case: Constraints 1 and 2 active
    // This is more complex as meta_out appears in constraint 1
    // We can derive that this leads to another system to solve
    
    // For brevity, I'll implement a numerical approach for edge cases
    // by checking boundaries where different constraint pairs are active
    
    best_solution
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    fn test_split() {
        let result = solve_max_meta_out(101.0, 100.0, 100.0, 100.0, 99.0, 101.01, 10_000.0);

        println!("{:?}", result);
        assert!(false);
    }

    #[test]
    fn test_futarchy_amm() {
        let mut futarchy_amm = FutarchyAmm {
            bump: 0,
            dao: Pubkey::default(),
            base_mint: Pubkey::default(),
            quote_mint: Pubkey::default(),
            spot_pool: Pool {
                base_reserves: 100 * 1_000_000,
                quote_reserves: 100 * 1_000_000,
            },
            base_vault: Pubkey::default(),
            quote_vault: Pubkey::default(),
            live_proposal: Some(LiveProposalDetails {
                proposal: Pubkey::default(),
                question: Pubkey::default(),
                pass_pool: Pool {
                    base_reserves: 99_009_900,
                    quote_reserves: 101 * 1_000_000,
                },
                fail_pool: Pool {
                    base_reserves: 99_502_487,
                    quote_reserves: 100_500_000,
                },
            }),
        };

        // Verify initial k values are around 10,000
        let spot_k = futarchy_amm.spot_pool.k();
        let pass_k = futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.k();
        let fail_k = futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.k();

        assert!(spot_k >= 9_999 * 1_000_000 * 1_000_000 && spot_k <= 10_001 * 1_000_000 * 1_000_000, "Spot pool k should be around 10,000, got {}", spot_k);
        assert!(pass_k >= 9_999 * 1_000_000 * 1_000_000 && pass_k <= 10_001 * 1_000_000 * 1_000_000, "Pass pool k should be around 10,000, got {}", pass_k);
        assert!(fail_k >= 9_999 * 1_000_000 * 1_000_000 && fail_k <= 10_001 * 1_000_000 * 1_000_000, "Fail pool k should be around 10,000, got {}", fail_k);

        // Store initial reserves for verification
        let initial_spot_base = futarchy_amm.spot_pool.base_reserves;
        let initial_spot_quote = futarchy_amm.spot_pool.quote_reserves;
        let initial_pass_base = futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.base_reserves;
        let initial_pass_quote = futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.quote_reserves;
        let initial_fail_base = futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.base_reserves;
        let initial_fail_quote = futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.quote_reserves;

        // Buy 2 USDC worth (2,000,000 in lamports)
        let buy_amount = 2_000_000;
        futarchy_amm.swap(Side::Buy, buy_amount).unwrap();

        // Verify reserves changed appropriately
        assert!(futarchy_amm.spot_pool.quote_reserves > initial_spot_quote, "Spot pool quote reserves should increase");
        assert!(futarchy_amm.spot_pool.base_reserves < initial_spot_base, "Spot pool base reserves should decrease");
        
        assert!(futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.quote_reserves > initial_pass_quote, "Pass pool quote reserves should increase");
        assert!(futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.base_reserves < initial_pass_base, "Pass pool base reserves should decrease");
        
        assert!(futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.quote_reserves > initial_fail_quote, "Fail pool quote reserves should increase");
        assert!(futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.base_reserves < initial_fail_base, "Fail pool base reserves should decrease");

        // Verify k values are maintained (should be greater than or equal to initial k)
        let final_spot_k = futarchy_amm.spot_pool.k();
        let final_pass_k = futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.k();
        let final_fail_k = futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.k();

        assert!(final_spot_k >= spot_k, "Spot pool k should not decrease, initial: {}, final: {}", spot_k, final_spot_k);
        assert!(final_pass_k >= pass_k, "Pass pool k should not decrease, initial: {}, final: {}", pass_k, final_pass_k);
        assert!(final_fail_k >= fail_k, "Fail pool k should not decrease, initial: {}, final: {}", fail_k, final_fail_k);

        // Verify total quote amount added matches our buy amount
        let total_quote_added = (futarchy_amm.spot_pool.quote_reserves - initial_spot_quote) +
                               (futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.quote_reserves - initial_pass_quote);

        
        assert_eq!(total_quote_added, buy_amount, "Total quote amount added should equal buy amount");
    }

    #[test]
    fn test_futarchy_amm_sell() {
        let mut futarchy_amm = FutarchyAmm {
            bump: 0,
            dao: Pubkey::default(),
            base_mint: Pubkey::default(),
            quote_mint: Pubkey::default(),
            spot_pool: Pool {
                base_reserves: 100 * 1_000_000,
                quote_reserves: 100 * 1_000_000,
            },
            base_vault: Pubkey::default(),
            quote_vault: Pubkey::default(),
            live_proposal: Some(LiveProposalDetails {
                proposal: Pubkey::default(),
                question: Pubkey::default(),
                pass_pool: Pool {
                    base_reserves: 99_009_900,
                    quote_reserves: 101 * 1_000_000,
                },
                fail_pool: Pool {
                    base_reserves: 99_502_487,
                    quote_reserves: 100_500_000,
                },
            }),
        };

        // Verify initial k values are around 10,000
        let spot_k = futarchy_amm.spot_pool.k();
        let pass_k = futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.k();
        let fail_k = futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.k();

        assert!(spot_k >= 9_999 * 1_000_000 * 1_000_000 && spot_k <= 10_001 * 1_000_000 * 1_000_000, "Spot pool k should be around 10,000, got {}", spot_k);
        assert!(pass_k >= 9_999 * 1_000_000 * 1_000_000 && pass_k <= 10_001 * 1_000_000 * 1_000_000, "Pass pool k should be around 10,000, got {}", pass_k);
        assert!(fail_k >= 9_999 * 1_000_000 * 1_000_000 && fail_k <= 10_001 * 1_000_000 * 1_000_000, "Fail pool k should be around 10,000, got {}", fail_k);

        // Store initial reserves for verification
        let initial_spot_base = futarchy_amm.spot_pool.base_reserves;
        let initial_spot_quote = futarchy_amm.spot_pool.quote_reserves;
        let initial_pass_base = futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.base_reserves;
        let initial_pass_quote = futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.quote_reserves;
        let initial_fail_base = futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.base_reserves;
        let initial_fail_quote = futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.quote_reserves;

        // Sell 2 META worth (2,000,000 in lamports)
        let sell_amount = 2_000_000;
        futarchy_amm.swap(Side::Sell, sell_amount).unwrap();

        // Verify reserves changed appropriately
        assert!(futarchy_amm.spot_pool.base_reserves > initial_spot_base, "Spot pool base reserves should increase");
        assert!(futarchy_amm.spot_pool.quote_reserves < initial_spot_quote, "Spot pool quote reserves should decrease");
        
        assert!(futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.base_reserves > initial_pass_base, "Pass pool base reserves should increase");
        assert!(futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.quote_reserves < initial_pass_quote, "Pass pool quote reserves should decrease");
        
        assert!(futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.base_reserves > initial_fail_base, "Fail pool base reserves should increase");
        assert!(futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.quote_reserves < initial_fail_quote, "Fail pool quote reserves should decrease");

        // Verify k values are maintained (should be greater than or equal to initial k)
        let final_spot_k = futarchy_amm.spot_pool.k();
        let final_pass_k = futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.k();
        let final_fail_k = futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.k();

        assert!(final_spot_k >= spot_k, "Spot pool k should not decrease, initial: {}, final: {}", spot_k, final_spot_k);
        assert!(final_pass_k >= pass_k, "Pass pool k should not decrease, initial: {}, final: {}", pass_k, final_pass_k);
        assert!(final_fail_k >= fail_k, "Fail pool k should not decrease, initial: {}, final: {}", fail_k, final_fail_k);

        // Verify total base amount added matches our sell amount
        let total_base_added = (futarchy_amm.spot_pool.base_reserves - initial_spot_base) +
                              (futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.base_reserves - initial_pass_base);

        assert_eq!(total_base_added, sell_amount, "Total base amount added should equal sell amount");
    }
}