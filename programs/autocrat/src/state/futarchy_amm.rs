use anchor_lang::prelude::*;

use crate::AutocratError;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Eq, PartialEq, Clone)]
pub enum TokenTypeFull {
    UnconditionalQuote,
    UnconditionalBase,
    PassQuote,
    PassBase,
    FailQuote,
    FailBase,
}





#[derive(AnchorSerialize, AnchorDeserialize, Debug, Eq, PartialEq, Clone)]
pub enum Side {
    Buy,
    Sell,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Eq, PartialEq, Clone, InitSpace)]
pub enum AmmState {
    Spot,
    Futarchy {
        proposal: Pubkey,
        question: Pubkey,
    }
}


#[account]
#[derive(InitSpace, Debug)]
pub struct Amm {
    pub bump: u8,
    pub dao: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,
    pub state: AmmState,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Eq, PartialEq, Clone, InitSpace)]
pub struct ConstantProductAmm {
    pub pool: Pool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Eq, PartialEq, Clone, InitSpace)]
pub struct FutarchyAmm {
    pub fail: Pool,
    pub pass: Pool,
    pub spot: Pool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Eq, PartialEq, Clone, InitSpace)]
pub struct Pool {
    pub quote_reserves: u64,
    pub base_reserves: u64,
}

impl Pool {
    pub fn k(&self) -> u128 {
        self.quote_reserves as u128 * self.base_reserves as u128
    }
    
    pub fn state_transition(&mut self, new_quote_reserves: u64, new_base_reserves: u64) -> Result<()> {
        let current_k = self.k();

        self.quote_reserves = new_quote_reserves;
        self.base_reserves = new_base_reserves;

        let new_k = self.k();

        require_gte!(new_k, current_k);

        Ok(())
    }
}



