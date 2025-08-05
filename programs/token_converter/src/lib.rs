use anchor_lang::prelude::*;

pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("tknMiQZDHrrJe4VDESf3cJorj1jWCfCYK2g4d7nqjT1");

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
        burn_inbound_token: bool,
        nonce: u64,
    ) -> Result<()> {
        instructions::initialize_token_converter(ctx, conversion_ratio, burn_inbound_token, nonce)
    }

    pub fn convert(ctx: Context<Convert>, amount: u64) -> Result<()> {
        instructions::convert(ctx, amount)
    }
}