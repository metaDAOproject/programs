//! A smart contract that facilitates the creation of new futarchic DAOs.
use anchor_lang::prelude::*;

pub mod allocator;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

pub use instructions::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "launchpad_v8",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/programs",
    source_release: "v0.8.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("moonDJUoHteKkGATejA5bdJVwJ6V6Dg74gyqyJTx73n");

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

// PP v2 tranche config
pub const PP_NUM_TRANCHES: usize = 5;
pub const PP_PRICE_MULTIPLIERS: [u128; 5] = [2, 4, 8, 16, 32];

// FutarchyTwap min_duration: 3 months
pub const PP_TWAP_MIN_DURATION: u32 = 3 * 30 * 24 * 60 * 60; // 7_776_000 seconds

pub mod usdc_mint {
    use anchor_lang::prelude::declare_id;

    #[cfg(feature = "devnet")]
    declare_id!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

    #[cfg(not(feature = "devnet"))]
    declare_id!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
}

pub mod metadao_multisig_vault {
    use anchor_lang::prelude::declare_id;

    // MetaDAO operations multisig vault
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

#[program]
pub mod launchpad_v8 {
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

    #[access_control(ctx.accounts.validate())]
    pub fn close_launch(ctx: Context<CloseLaunch>) -> Result<()> {
        CloseLaunch::handle(ctx)
    }

    #[access_control(ctx.accounts.validate(approved_amount))]
    pub fn set_funding_record_approval(
        ctx: Context<SetFundingRecordApproval>,
        approved_amount: u64,
    ) -> Result<()> {
        SetFundingRecordApproval::handle(ctx, approved_amount)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn settle_launch(ctx: Context<SettleLaunch>) -> Result<()> {
        SettleLaunch::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        Claim::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        Refund::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn claim_additional_token_allocation(
        ctx: Context<ClaimAdditionalTokenAllocation>,
    ) -> Result<()> {
        ClaimAdditionalTokenAllocation::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn finalize_launch(ctx: Context<FinalizeLaunch>) -> Result<()> {
        FinalizeLaunch::handle(ctx)
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn extend_launch(ctx: Context<ExtendLaunch>, args: ExtendLaunchArgs) -> Result<()> {
        ExtendLaunch::handle(ctx, args)
    }
}
