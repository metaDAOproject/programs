//! A big wall of cash sitting at NAV, ready to take tokens from weak hands and burn them.
use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;

use instructions::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "bid_wall",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/programs",
    source_release: "v0.7.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("WALL8ucBuUyL46QYxwYJjidaFYhdvxUFrgvBxPshERx");

pub const TOKEN_SCALE: u64 = 1_000_000;

pub mod usdc_mint {
    use anchor_lang::prelude::declare_id;

    #[cfg(feature = "devnet")]
    declare_id!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

    #[cfg(not(feature = "devnet"))]
    declare_id!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
}

#[program]
pub mod bid_wall {
    use super::*;

    #[access_control(ctx.accounts.validate(&args))]
    pub fn initialize_bid_wall(
        ctx: Context<InitializeBidWall>,
        args: InitializeBidWallArgs,
    ) -> Result<()> {
        InitializeBidWall::handle(ctx, args)
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn close_bid_wall(ctx: Context<CloseBidWall>, args: CloseBidWallArgs) -> Result<()> {
        CloseBidWall::handle(ctx, args)
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn sell_tokens(ctx: Context<SellTokens>, args: SellTokensArgs) -> Result<()> {
        SellTokens::handle(ctx, args)
    }
}
