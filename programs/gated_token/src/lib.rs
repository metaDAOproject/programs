use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

pub use constants::*;
pub use error::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "gated_token",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/programs",
    source_release: "v0.1.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("GaTEjZy6eMdHg2BcL8dk3iE78jkJ9sPtyw1q2tMNi8PA");

#[program]
pub mod gated_token {
    use super::*;

    #[access_control(ctx.accounts.validate())]
    pub fn initialize_gated_mint(ctx: Context<InitializeGatedMint>) -> Result<()> {
        InitializeGatedMint::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn add_whitelisted_user(ctx: Context<AddWhitelistedUser>) -> Result<()> {
        AddWhitelistedUser::handle(ctx)
    }
}
