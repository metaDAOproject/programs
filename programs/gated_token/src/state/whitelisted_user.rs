use anchor_lang::prelude::*;

pub const WHITELISTED_USER_SEED: &[u8] = b"whitelisted_user";

#[account]
#[derive(InitSpace)]
pub struct WhitelistedUser {
    pub mint: Pubkey,
    pub user: Pubkey,
    pub bump: u8,
}
