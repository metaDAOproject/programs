//! Manages the orderly liquidation of a project's treasury back to token holders.
use anchor_lang::prelude::*;

pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "liquidation",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/programs",
    source_release: "v0.1.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("LiQnowFbFQdYyZhF4pUbpsrZCjxRTQ1upKJxZ2VXjde");

#[program]
pub mod liquidation {
    use super::*;

    #[access_control(ctx.accounts.validate(&args))]
    pub fn initialize_liquidation(
        ctx: Context<InitializeLiquidation>,
        args: InitializeLiquidationArgs,
    ) -> Result<()> {
        InitializeLiquidation::handle(ctx, args)
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn set_refund_record(
        ctx: Context<SetRefundRecord>,
        args: SetRefundRecordArgs,
    ) -> Result<()> {
        SetRefundRecord::handle(ctx, args)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn activate_liquidation(ctx: Context<ActivateLiquidation>) -> Result<()> {
        ActivateLiquidation::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        Refund::handle(ctx)
    }
}
