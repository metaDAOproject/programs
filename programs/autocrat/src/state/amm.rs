use anchor_lang::prelude::*;

#[account]
pub struct Amm {
    pub state: State,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace, Debug)]
pub enum State {
    Spot { 
        spot: Pool,
    },
    Futarchy {
        spot: Pool,
        pass: Pool,
        fail: Pool,
    }
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
}