use crate::FuzzTest;
use crate::UserTracking;
use trident_fuzz::fuzzing::*;

use crate::common::constants::*;
use crate::common::types::futarchy;
use crate::methods;

impl FuzzTest {
    /// Gets the tracking struct for a given provider, creating it if it doesn't exist
    pub fn get_user_tracking(&mut self, provider: Pubkey) -> &mut UserTracking {
        self.user_tracking.entry(provider).or_default()
    }

    /// Gets token balance for a given mint and owner
    pub fn get_token_balance(&mut self, mint: Pubkey, owner: Pubkey) -> u64 {
        let ata = self
            .trident
            .get_associated_token_address(&mint, &owner, &TOKEN_PROGRAM_ID);

        match self.trident.get_token_account(ata) {
            Ok(account) => account.account.amount,
            Err(_) => 0,
        }
    }

    /// Gets the liquidity amount for a user's AMM position
    pub fn get_position_liquidity(&mut self, owner: Pubkey) -> u128 {
        let position = methods::pda::get_amm_position_pda(&mut self.trident, self.dao, owner);
        match self
            .trident
            .get_account_with_type::<futarchy::AmmPosition>(&position, None)
        {
            Some(position_account) => position_account.liquidity,
            None => 0,
        }
    }

    /// Gets current spot pool reserves and total liquidity
    pub fn get_spot_reserves(&mut self) -> (u64, u64, u128) {
        let dao_data = self
            .trident
            .get_account_with_type::<futarchy::Dao>(&self.dao, None)
            .expect("Dao not found");

        match dao_data.amm.state {
            futarchy::PoolState::Spot { spot } => (
                spot.baseReserves,
                spot.quoteReserves,
                dao_data.amm.totalLiquidity,
            ),
            futarchy::PoolState::Futarchy { .. } => {
                panic!("Liquidity fuzz expects DAO AMM to stay in Spot state")
            }
        }
    }
}
