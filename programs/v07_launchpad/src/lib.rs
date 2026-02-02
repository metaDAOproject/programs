//! A smart contract that facilitates the creation of new futarchic DAOs.
use anchor_lang::prelude::*;

pub mod allocator;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "launchpad_v7",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/programs",
    source_release: "v0.7.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("moontUzsdepotRGe5xsfip7vLPTJnVuafqdUWexVnPM");

pub const TOKEN_SCALE: u64 = 1_000_000;

pub const PRICE_SCALE: u128 = 1_000_000_000_000;

/// 10M tokens with 6 decimals
pub const TOKENS_TO_PARTICIPANTS: u64 = 10_000_000 * TOKEN_SCALE;
/// 20% to liquidity
pub const TOKENS_TO_FUTARCHY_LIQUIDITY: u64 = 2_000_000 * TOKEN_SCALE;
/// 3M tokens to single-sided DammV2 liquidity
pub const TOKENS_TO_DAMM_V2_LIQUIDITY: u64 = TOKENS_TO_DAMM_V2_LIQUIDITY_UNSCALED * TOKEN_SCALE;
/// we need this to prevent overflow
pub const TOKENS_TO_DAMM_V2_LIQUIDITY_UNSCALED: u64 = 900_000;
/// 15% of the floating supply to stake
pub const PROPOSAL_MIN_STAKE_TOKENS: u64 = 1_500_000 * TOKEN_SCALE;

/// Max 50% premine
pub const MAX_PREMINE: u64 = 15_000_000 * TOKEN_SCALE;

pub mod usdc_mint {
    use anchor_lang::prelude::declare_id;

    #[cfg(feature = "devnet")]
    declare_id!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

    #[cfg(not(feature = "devnet"))]
    declare_id!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
}

// TODO - Pileks: Set this to the correct fee recipient address
pub mod fee_recipient {
    use anchor_lang::prelude::declare_id;

    // MetaDAO multisig vault
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

#[program]
pub mod launchpad_v7 {
    use super::*;

    #[access_control(ctx.accounts.validate(&args))]
    pub fn initialize_launch(
        ctx: Context<InitializeLaunch>,
        args: InitializeLaunchArgs,
    ) -> Result<()> {
        InitializeLaunch::handle(ctx, args)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn start_launch(ctx: Context<StartLaunch>) -> Result<()> {
        StartLaunch::handle(ctx)
    }

    #[access_control(ctx.accounts.validate(amount))]
    pub fn fund(ctx: Context<Fund>, amount: u64) -> Result<()> {
        Fund::handle(ctx, amount)
    }

    #[access_control(ctx.accounts.validate(approved_amount))]
    pub fn set_funding_record_approval(
        ctx: Context<SetFundingRecordApproval>,
        approved_amount: u64,
    ) -> Result<()> {
        SetFundingRecordApproval::handle(ctx, approved_amount)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn complete_launch(ctx: Context<CompleteLaunch>) -> Result<()> {
        CompleteLaunch::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        Refund::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        Claim::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn close_launch(ctx: Context<CloseLaunch>) -> Result<()> {
        CloseLaunch::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn claim_additional_token_allocation(
        ctx: Context<ClaimAdditionalTokenAllocation>,
    ) -> Result<()> {
        ClaimAdditionalTokenAllocation::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn initialize_performance_package(
        ctx: Context<InitializePerformancePackage>,
    ) -> Result<()> {
        InitializePerformancePackage::handle(ctx)
    }
}
