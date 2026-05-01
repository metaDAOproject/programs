use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::pubkey;

pub const WHITELISTED_PROGRAMS: &[Pubkey] = &[
    pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    pubkey!("FUTARELBfJfQ8RDGhg1wdhddq1odMAJUePHFuBYfUxKq"),
    pubkey!("moonDJUoHteKkGATejA5bdJVwJ6V6Dg74gyqyJTx73n"),
    pubkey!("VLTX1ishMBbcX3rdBWGssxawAo1Q2X2qxYFYqiGodVg"),
    pubkey!("WALL8ucBuUyL46QYxwYJjidaFYhdvxUFrgvBxPshERx"),
    pubkey!("gvnr27cVeyW3AVf3acL7VCJ5WjGAphytnsgcK1feHyH"),
    pubkey!("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG"),
];

pub const TOKEN_ACCOUNT_LEN: usize = 165;
pub const TOKEN_ACCOUNT_MINT_OFFSET: usize = 0;
pub const TOKEN_ACCOUNT_STATE_OFFSET: usize = 108;

pub const TOKEN_STATE_UNINITIALIZED: u8 = 0;
pub const TOKEN_STATE_INITIALIZED: u8 = 1;
pub const TOKEN_STATE_FROZEN: u8 = 2;
