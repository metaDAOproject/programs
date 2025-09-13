use anchor_lang::prelude::*;

// use crate::{FutarchyError, LP_TAKER_FEE_BPS, MAX_BPS, PROTOCOL_TAKER_FEE_BPS};
pub const LP_TAKER_FEE_BPS: u16 = 25;
pub const PROTOCOL_TAKER_FEE_BPS: u16 = 25;
pub const MAX_BPS: u16 = 10_000;
pub const PRICE_SCALE: u128 = 1_000_000_000_000;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, InitSpace)]
pub struct Dao {
    /// Embedded FutarchyAmm - 1:1 relationship
    pub amm: FutarchyAmm,
    /// `nonce` + `dao_creator` are PDA seeds
    pub nonce: u64,
    pub dao_creator: Pubkey,
    pub pda_bump: u8,
    pub squads_multisig: Pubkey,
    pub squads_multisig_vault: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub proposal_count: u32,
    // the percentage, in basis points, the pass price needs to be above the
    // fail price in order for the proposal to pass
    pub pass_threshold_bps: u16,
    pub seconds_per_proposal: u32,
    /// For manipulation-resistance the TWAP is a time-weighted average observation,
    /// where observation tries to approximate price but can only move by
    /// `twap_max_observation_change_per_update` per update. Because it can only move
    /// a little bit per update, you need to check that it has a good initial observation.
    /// Otherwise, an attacker could create a very high initial observation in the pass
    /// market and a very low one in the fail market to force the proposal to pass.
    ///
    /// We recommend setting an initial observation around the spot price of the token,
    /// and max observation change per update around 2% the spot price of the token.
    /// For example, if the spot price of META is $400, we'd recommend setting an initial
    /// observation of 400 (converted into the AMM prices) and a max observation change per
    /// update of 8 (also converted into the AMM prices). Observations can be updated once
    /// a minute, so 2% allows the proposal market to reach double the spot price or 0
    /// in 50 minutes.
    pub twap_initial_observation: u128,
    pub twap_max_observation_change_per_update: u128,
    /// Forces TWAP calculation to start after `twap_start_delay_seconds` seconds
    pub twap_start_delay_seconds: u32,
    /// As an anti-spam measure and to help liquidity, you need to lock up some liquidity
    /// in both futarchic markets in order to create a proposal.
    ///
    /// For example, for META, we can use a `min_quote_futarchic_liquidity` of
    /// 5000 * 1_000_000 (5000 USDC) and a `min_base_futarchic_liquidity` of
    /// 10 * 1_000_000_000 (10 META).
    pub min_quote_futarchic_liquidity: u64,
    pub min_base_futarchic_liquidity: u64,
    /// Minimum amount of base tokens that must be staked to launch a proposal
    pub base_to_stake: u64,
    pub seq_num: u64,
    pub initial_spending_limit: Option<InitialSpendingLimit>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub struct InitialSpendingLimit {
    pub amount_per_month: u64,
    #[max_len(10)]
    pub members: Vec<Pubkey>,
}

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

impl PoolState {
    pub fn swap(&mut self, input_amount: u64, swap_type: SwapType) -> Result<u64> {
        match self {
            PoolState::Spot { spot } => {
                spot.swap(input_amount, swap_type)
            }
            PoolState::Futarchy { spot, pass, fail } => {
                let spot_output = spot.swap(input_amount, swap_type)?;

                let arbitrage_result =
                    arbitrage_after_spot_swap(spot, pass, fail, spot_output, swap_type)?;

                Ok(spot_output + arbitrage_result.spot_profit)
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

pub struct FutarchyAmmSwap {
    pub dao: Pubkey,
    pub trader: Pubkey,
    pub user_base_account: Pubkey,
    pub user_quote_account: Pubkey,
    pub amm_base_vault: Pubkey,
    pub amm_quote_vault: Pubkey,
    pub token_program: Pubkey,
    pub futarchy_program: Pubkey,
    pub futarchy_event_authority: Pubkey,
}

impl From<FutarchyAmmSwap> for Vec<AccountMeta> {
    fn from(accounts: FutarchyAmmSwap) -> Self {
        vec![
            AccountMeta::new(accounts.dao, false),
            AccountMeta::new(accounts.trader, true),
            AccountMeta::new(accounts.user_base_account, false),
            AccountMeta::new(accounts.user_quote_account, false),
            AccountMeta::new(accounts.amm_base_vault, false),
            AccountMeta::new(accounts.amm_quote_vault, false),
            AccountMeta::new_readonly(accounts.token_program, false),
            AccountMeta::new_readonly(accounts.futarchy_event_authority, false),
            AccountMeta::new_readonly(accounts.futarchy_program, false),
        ]
    }
}
