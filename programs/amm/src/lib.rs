use anchor_lang::prelude::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "amm",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/futarchy",
    source_release: "v0.5.0",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use crate::events::*;
use crate::instructions::*;
use crate::state::*;

declare_id!("AMMyu265tkBpRW21iGQxKGLaves3gKm2JcMUqfXNSpqD");

#[program]
pub mod amm {
    use self::add_liquidity::AddLiquidityArgs;

    use super::*;

    #[access_control(ctx.accounts.validate())]
    pub fn create_amm(ctx: Context<CreateAmm>, args: CreateAmmArgs) -> Result<()> {
        CreateAmm::handle(ctx, args)
    }

    pub fn add_liquidity(ctx: Context<AddOrRemoveLiquidity>, args: AddLiquidityArgs) -> Result<()> {
        AddOrRemoveLiquidity::handle_add(ctx, args)
    }

    pub fn remove_liquidity(
        ctx: Context<AddOrRemoveLiquidity>,
        args: RemoveLiquidityArgs,
    ) -> Result<()> {
        AddOrRemoveLiquidity::handle_remove(ctx, args)
    }

    pub fn swap(ctx: Context<Swap>, args: SwapArgs) -> Result<()> {
        Swap::handle(ctx, args)
    }

    pub fn crank_that_twap(ctx: Context<CrankThatTwap>) -> Result<()> {
        CrankThatTwap::handle(ctx)
    }
}
