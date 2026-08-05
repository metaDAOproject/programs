//! Types for reading pump_amm accounts.
use anchor_lang::prelude::*;

use crate::error::RelaunchError;

pub const POOL_DISCRIMINATOR: [u8; 8] = [241, 154, 109, 4, 17, 177, 109, 188];

/// The prefix of pump_amm's `Pool` account that canonicality validation
/// reads; trailing fields are ignored.
#[derive(AnchorDeserialize)]
pub struct PumpSwapPool {
    pub pool_bump: u8,
    pub index: u16,
    pub creator: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
}

impl PumpSwapPool {
    pub fn try_parse(data: &[u8]) -> Result<Self> {
        require!(
            data.len() > POOL_DISCRIMINATOR.len() && data[..8] == POOL_DISCRIMINATOR,
            RelaunchError::SourcePoolNotCanonical
        );
        Self::deserialize(&mut &data[8..])
            .map_err(|_| error!(RelaunchError::SourcePoolNotCanonical))
    }
}
