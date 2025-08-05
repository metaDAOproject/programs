use anchor_lang::prelude::*;

pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("A5Tx19gQkMAdo8rWz9tTpbKWhGM2jMn59FP7vanNnvEf");

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "launchpad",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/futarchy",
    source_release: "v0.5.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

#[program]
pub mod token_converter {
    use super::*;

    pub fn initialize_token_converter(
        ctx: Context<InitializeTokenConverter>,
        conversion_ratio: u64,
        nonce: u64,
    ) -> Result<()> {
        instructions::initialize_token_converter(ctx, conversion_ratio, nonce)
    }

    pub fn convert(ctx: Context<Convert>, amount: u64) -> Result<()> {
        instructions::convert(ctx, amount)
    }
}