//! Price-Based Performance Package
//!
//! This program allows organizations to lock tokens that are unlocked to
//! recipients when those prices hit certain price thresholds.
//!
//! These tokens are split into up to 10 tranches, each of which is unlocked at a
//! different price threshold.
pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "price_based_performance_package",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/programs",
    source_release: "v0.6.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("pbPPQH7jyKoSLu8QYs3rSY3YkDRXEBojKbTgnUg7NDS");

#[program]
pub mod price_based_performance_package {
    use super::*;

    pub fn initialize_performance_package(
        ctx: Context<InitializePerformancePackage>,
        params: InitializePerformancePackageParams,
    ) -> Result<()> {
        InitializePerformancePackage::handle(ctx, params)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn start_unlock(ctx: Context<StartUnlock>) -> Result<()> {
        StartUnlock::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn complete_unlock(ctx: Context<CompleteUnlock>) -> Result<()> {
        CompleteUnlock::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn propose_change(ctx: Context<ProposeChange>, params: ProposeChangeParams) -> Result<()> {
        ProposeChange::handle(ctx, params)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn execute_change(ctx: Context<ExecuteChange>) -> Result<()> {
        ExecuteChange::handle(ctx)
    }

    pub fn change_performance_package_authority(
        ctx: Context<ChangePerformancePackageAuthority>,
        params: ChangePerformancePackageAuthorityParams,
    ) -> Result<()> {
        ChangePerformancePackageAuthority::handle(ctx, params)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn burn_performance_package(ctx: Context<BurnPerformancePackage>) -> Result<()> {
        BurnPerformancePackage::handle(ctx)
    }
}
