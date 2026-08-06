//! A smart contract that relaunches existing tokens as futarchic DAOs.
use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod pump_amm;
pub mod state;

pub use constants::*;
pub use state::*;

use instructions::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "relaunch",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/programs",
    source_release: "v0.1.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("vaMpdXN2P3Z5v8y6GtAU5NzCUjxtphnRVpvqu37Spik");

#[program]
pub mod relaunch {
    use super::*;

    #[access_control(ctx.accounts.validate(&args))]
    pub fn initialize_relaunch(
        ctx: Context<InitializeRelaunch>,
        args: InitializeRelaunchArgs,
    ) -> Result<()> {
        InitializeRelaunch::handle(ctx, args)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn start_deposits(ctx: Context<StartDeposits>) -> Result<()> {
        StartDeposits::handle(ctx)
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn deposit(ctx: Context<Deposit>, args: DepositArgs) -> Result<()> {
        Deposit::handle(ctx, args)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn close_deposits(ctx: Context<CloseDeposits>) -> Result<()> {
        CloseDeposits::handle(ctx)
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn execute_sell(ctx: Context<ExecuteSell>, args: ExecuteSellArgs) -> Result<()> {
        ExecuteSell::handle(ctx, args)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn mark_failed(ctx: Context<MarkFailed>) -> Result<()> {
        MarkFailed::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        ClaimRefund::handle(ctx)
    }
}
