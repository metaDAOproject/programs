use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

use crate::common::constants::*;
use crate::common::types::futarchy;

impl FuzzTest {
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

    /// Gets current spot pool reserves, total liquidity, and protocol fee balances
    pub fn get_spot_reserves(&mut self) -> (u64, u64, u128, u64, u64) {
        let dao_data = self
            .trident
            .get_account_with_type::<futarchy::Dao>(&self.dao, None)
            .expect("Dao not found");

        match dao_data.amm.state {
            futarchy::PoolState::Spot { spot } => (
                spot.baseReserves,
                spot.quoteReserves,
                dao_data.amm.totalLiquidity,
                spot.baseProtocolFeeBalance,
                spot.quoteProtocolFeeBalance,
            ),
            futarchy::PoolState::Futarchy { .. } => {
                panic!("Spot trading fuzz expects DAO AMM to stay in Spot state")
            }
        }
    }
}
