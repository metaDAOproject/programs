//! Performance Package v2
//!
//! A token minting program that rewards teams based on achieved milestones.
//! Uses modular oracle readers and configurable reward functions.

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
    name: "performance_package_v2",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/programs",
    source_release: "v0.7.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("pPV2pfrxnmstSb9j7kEeCLny5BGj6SNwCWGd6xbGGzz");

#[program]
pub mod performance_package_v2 {
    use super::*;

    #[access_control(ctx.accounts.validate(&args))]
    pub fn initialize_performance_package(
        ctx: Context<InitializePerformancePackage>,
        args: InitializePerformancePackageArgs,
    ) -> Result<()> {
        InitializePerformancePackage::handle(ctx, args)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn start_unlock(ctx: Context<StartUnlock>) -> Result<()> {
        StartUnlock::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn complete_unlock(ctx: Context<CompleteUnlock>) -> Result<()> {
        CompleteUnlock::handle(ctx)
    }
}
