use super::*;

#[account]
#[derive(InitSpace)]
pub struct StakeAccount {
    pub proposal: Pubkey,
    pub staker: Pubkey,
    pub amount: u64,
    pub bump: u8,
}
