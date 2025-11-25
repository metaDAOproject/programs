use anchor_lang::prelude::*;
use static_assertions::const_assert_eq;

use crate::error::BidWallError;

use super::NUM_REWARDS;

#[zero_copy]
#[derive(InitSpace, Debug, Default)]
pub struct Position {
    pub pool: Pubkey,
    /// nft mint
    pub nft_mint: Pubkey,
    /// fee a checkpoint
    pub fee_a_per_token_checkpoint: [u8; 32], // U256
    /// fee b checkpoint
    pub fee_b_per_token_checkpoint: [u8; 32], // U256
    /// fee a pending
    pub fee_a_pending: u64,
    /// fee b pending
    pub fee_b_pending: u64,
    /// unlock liquidity
    pub unlocked_liquidity: u128,
    /// vesting liquidity
    pub vested_liquidity: u128,
    /// permanent locked liquidity
    pub permanent_locked_liquidity: u128,
    /// metrics
    pub metrics: PositionMetrics,
    /// Farming reward information
    pub reward_infos: [UserRewardInfo; NUM_REWARDS],
    /// padding for future usage
    pub padding: [u128; 6],
}

const_assert_eq!(Position::INIT_SPACE, 400);

#[zero_copy]
#[derive(Debug, InitSpace, Default)]
pub struct PositionMetrics {
    pub total_claimed_a_fee: u64,
    pub total_claimed_b_fee: u64,
}

const_assert_eq!(PositionMetrics::INIT_SPACE, 16);

#[zero_copy]
#[derive(Default, Debug, InitSpace, PartialEq)]
pub struct UserRewardInfo {
    /// The latest update reward checkpoint
    pub reward_per_token_checkpoint: [u8; 32], // U256
    /// Current pending rewards
    pub reward_pendings: u64,
    /// Total claimed rewards
    pub total_claimed_rewards: u64,
}

const_assert_eq!(UserRewardInfo::INIT_SPACE, 48);

impl Position {
    pub const fn discriminator() -> [u8; 8] {
        [170, 188, 143, 228, 122, 64, 247, 208]
    }

    pub fn validate_discriminator(discriminator: &[u8]) -> Result<()> {
        if discriminator != &Self::discriminator() {
            return Err(BidWallError::MeteoraDammPositionDiscriminatorMismatch.into());
        }
        Ok(())
    }
}
