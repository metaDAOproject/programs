use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use conditional_vault::program::ConditionalVault as ConditionalVaultProgram;
use conditional_vault::{ConditionalVault, Question};

pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

pub use error::FutarchyError;
pub use events::*;
pub use instructions::*;
pub use state::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "futarchy",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/programs",
    source_release: "v0.6.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("FUTARELBfJfQ8RDGhg1wdhddq1odMAJUePHFuBYfUxKq");

pub const SLOTS_PER_10_SECS: u64 = 25;
pub const ONE_MINUTE_IN_SLOTS: u64 = 6 * SLOTS_PER_10_SECS;

pub const MIN_QUOTE_LIQUIDITY: u64 = 100_000;

pub const TEN_DAYS_IN_SECONDS: i64 = 10 * 24 * 60 * 60;

pub const PRICE_SCALE: u128 = 1_000_000_000_000;

// by default, the pass price needs to be 3% higher than the fail price
pub const DEFAULT_PASS_THRESHOLD_BPS: u16 = 300;

pub const LP_TAKER_FEE_BPS: u16 = 25;
pub const PROTOCOL_TAKER_FEE_BPS: u16 = 25;
pub const MAX_BPS: u16 = 10_000;

// the index of the fail and pass outcomes in the question and the index of
// the pass and fail conditional tokens in the conditional vault
pub const FAIL_INDEX: usize = 0;
pub const PASS_INDEX: usize = 1;

// TWAP can only move by $5 per slot
pub const DEFAULT_MAX_OBSERVATION_CHANGE_PER_UPDATE_LOTS: u64 = 5_000;

#[program]
pub mod futarchy {
    use super::*;

    pub fn initialize_dao(ctx: Context<InitializeDao>, params: InitializeDaoParams) -> Result<()> {
        InitializeDao::handle(ctx, params)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn initialize_proposal(ctx: Context<InitializeProposal>) -> Result<()> {
        InitializeProposal::handle(ctx)
    }

    #[access_control(ctx.accounts.validate(&params))]
    pub fn stake_to_proposal(
        ctx: Context<StakeToProposal>,
        params: StakeToProposalParams,
    ) -> Result<()> {
        StakeToProposal::handle(ctx, params)
    }

    #[access_control(ctx.accounts.validate(&params))]
    pub fn unstake_from_proposal(
        ctx: Context<UnstakeFromProposal>,
        params: UnstakeFromProposalParams,
    ) -> Result<()> {
        UnstakeFromProposal::handle(ctx, params)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn launch_proposal(ctx: Context<LaunchProposal>) -> Result<()> {
        LaunchProposal::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn finalize_proposal(ctx: Context<FinalizeProposal>) -> Result<()> {
        FinalizeProposal::handle(ctx)
    }

    pub fn update_dao(ctx: Context<UpdateDao>, dao_params: UpdateDaoParams) -> Result<()> {
        UpdateDao::handle(ctx, dao_params)
    }

    // AMM instructions

    pub fn spot_swap(ctx: Context<SpotSwap>, params: SpotSwapParams) -> Result<()> {
        SpotSwap::handle(ctx, params)
    }

    #[access_control(ctx.accounts.validate(&params))]
    pub fn conditional_swap(
        ctx: Context<ConditionalSwap>,
        params: ConditionalSwapParams,
    ) -> Result<()> {
        ConditionalSwap::handle(ctx, params)
    }

    pub fn provide_liquidity(
        ctx: Context<ProvideLiquidity>,
        params: ProvideLiquidityParams,
    ) -> Result<()> {
        ProvideLiquidity::handle(ctx, params)
    }

    pub fn withdraw_liquidity(
        ctx: Context<WithdrawLiquidity>,
        params: WithdrawLiquidityParams,
    ) -> Result<()> {
        WithdrawLiquidity::handle(ctx, params)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn collect_fees(ctx: Context<CollectFees>) -> Result<()> {
        CollectFees::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn execute_spending_limit_change<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, ExecuteSpendingLimitChange<'info>>,
    ) -> Result<()> {
        ExecuteSpendingLimitChange::handle(ctx)
    }
}
