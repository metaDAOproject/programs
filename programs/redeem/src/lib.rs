use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;

pub use instructions::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "redeem",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/futarchy",
    source_release: "v0.1.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("2yybFizjrwdYEKktHtvpXr9qSSpKLd3NzZE7p4batVAf");

#[program]
pub mod redeem {
    use super::*;

    #[access_control(ctx.accounts.validate())]
    pub fn redeem(ctx: Context<UnwindAndMigrate>) -> Result<()> {
        UnwindAndMigrate::handler(ctx)
    }
}