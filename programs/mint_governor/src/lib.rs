//! Mint Governor
//!
//! This program manages minting authority for SPL tokens, allowing an admin
//! to delegate minting rights to multiple authorized minters with optional limits.

use anchor_lang::prelude::*;

pub mod constants;
pub use constants::*;

pub mod events;
pub use events::*;

pub mod error;
pub use error::*;

pub mod state;
pub use state::*;

pub mod instructions;
pub use instructions::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "mint_governor",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/programs",
    source_release: "v0.7.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("gvnr27cVeyW3AVf3acL7VCJ5WjGAphytnsgcK1feHyH");

#[program]
pub mod mint_governor {
    use super::*;
}
