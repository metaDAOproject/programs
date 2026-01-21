use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::token_2022::Token2022;
use damm_v2_cpi::constants::seeds::{
    POOL_AUTHORITY_PREFIX, POOL_PREFIX, POSITION_NFT_ACCOUNT_PREFIX, POSITION_PREFIX,
    TOKEN_VAULT_PREFIX,
};
use damm_v2_cpi::constants::{MAX_SQRT_PRICE, MIN_SQRT_PRICE};
use damm_v2_cpi::program::DammV2Cpi;
use damm_v2_cpi::BaseFeeParameters;
use futarchy::program::Futarchy;
use futarchy::ProvideLiquidityParams;
use raydium_cpmm_cpi::program::RaydiumCpmm;
use spl_token;

pub mod error;
pub mod events;
pub mod instructions;

pub use error::*;
pub use events::*;
pub use instructions::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "raydium_migration_helper",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/programs",
    source_release: "v0.1.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "Helper program for atomically withdrawing Raydium LP and providing liquidity to futarchy V6 AMM"
}

declare_id!("migR87BnBEkJbbDECLzRxhmNsQ44WMzhDCpCJhfPvR1");

#[program]
pub mod raydium_migration_helper {
    use super::*;

    #[access_control(ctx.accounts.validate(lp_amount))]
    pub fn withdraw_and_provide_liquidity(
        ctx: Context<WithdrawAndProvideLiquidity>,
        lp_amount: u64,
        min_raydium_amount_0: u64,
        min_raydium_amount_1: u64,
        min_futarchy_liquidity: u64,
    ) -> Result<()> {
        WithdrawAndProvideLiquidity::handle(
            ctx,
            lp_amount,
            min_raydium_amount_0,
            min_raydium_amount_1,
            min_futarchy_liquidity,
        )
    }
}
