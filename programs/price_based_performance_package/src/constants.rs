use anchor_lang::prelude::*;

#[constant]
pub const MAX_TRANCHES: usize = 10;

/// Scale of oracle prices: quote atoms per base atom, times 1e12
#[constant]
pub const PRICE_SCALE: u128 = 1_000_000_000_000;
