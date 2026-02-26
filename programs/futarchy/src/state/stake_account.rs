use super::*;

pub const SEED_STAKE: &[u8] = b"stake";

#[account]
#[derive(InitSpace)]
pub struct StakeAccount {
    pub proposal: Pubkey,
    pub staker: Pubkey,
    pub amount: u64,
    pub bump: u8,
}
