use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use conditional_vault::program::ConditionalVault as ConditionalVaultProgram;
use conditional_vault::{ConditionalVault, Question};

pub mod error;
pub mod events;
pub mod instructions;
pub mod squads;
pub mod state;

pub use error::FutarchyError;
pub use events::*;
pub use instructions::*;
pub use squads::*;
pub use state::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "futarchy",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/programs",
    source_release: "v0.6.1",
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

// MetaDAO takes 0.5%, LP takes 0%
pub const LP_TAKER_FEE_BPS: u16 = 0;
pub const PROTOCOL_TAKER_FEE_BPS: u16 = 50;
pub const MAX_BPS: u16 = 10_000;

// the index of the fail and pass outcomes in the question and the index of
// the pass and fail conditional tokens in the conditional vault
pub const FAIL_INDEX: usize = 0;
pub const PASS_INDEX: usize = 1;

// TWAP can only move by $5 per slot
pub const DEFAULT_MAX_OBSERVATION_CHANGE_PER_UPDATE_LOTS: u64 = 5_000;

// Unstaking from a proposal should only be allowed after a small delay
pub const MIN_PROPOSAL_UNSTAKE_DELAY_SECONDS: i64 = 5;

#[program]
pub mod futarchy {
    use super::*;

    #[access_control(ctx.accounts.validate())]
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

    #[access_control(ctx.accounts.validate())]
    pub fn update_dao(ctx: Context<UpdateDao>, dao_params: UpdateDaoParams) -> Result<()> {
        UpdateDao::handle(ctx, dao_params)
    }

    pub fn resize_dao(ctx: Context<ResizeDao>) -> Result<()> {
        ResizeDao::handle(ctx)
    }

    pub fn resize_proposal(ctx: Context<ResizeProposal>) -> Result<()> {
        ResizeProposal::handle(ctx)
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

    #[access_control(ctx.accounts.validate())]
    pub fn sponsor_proposal(ctx: Context<SponsorProposal>) -> Result<()> {
        SponsorProposal::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn approve_proposal(ctx: Context<ApproveProposal>) -> Result<()> {
        ApproveProposal::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn collect_meteora_damm_fees(ctx: Context<CollectMeteoraDammFees>) -> Result<()> {
        CollectMeteoraDammFees::handle(ctx)
    }

    #[access_control(ctx.accounts.validate(&params))]
    pub fn initiate_vault_spend_optimistic_proposal(
        ctx: Context<InitiateVaultSpendOptimisticProposal>,
        params: InitiateVaultSpendOptimisticProposalParams,
    ) -> Result<()> {
        InitiateVaultSpendOptimisticProposal::handle(ctx, params)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn finalize_optimistic_proposal(ctx: Context<FinalizeOptimisticProposal>) -> Result<()> {
        FinalizeOptimisticProposal::handle(ctx)
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn admin_enqueue_multisig_proposal_approval(
        ctx: Context<AdminEnqueueMultisigProposalApproval>,
        args: AdminEnqueueMultisigProposalApprovalArgs,
    ) -> Result<()> {
        AdminEnqueueMultisigProposalApproval::handle(ctx, args)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn execute_multisig_proposal_approval(
        ctx: Context<ExecuteMultisigProposalApproval>,
    ) -> Result<()> {
        ExecuteMultisigProposalApproval::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn admin_execute_multisig_proposal<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, AdminExecuteMultisigProposal<'info>>,
    ) -> Result<()> {
        AdminExecuteMultisigProposal::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn admin_cancel_proposal(ctx: Context<AdminCancelProposal>) -> Result<()> {
        AdminCancelProposal::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn admin_remove_proposal(ctx: Context<AdminRemoveProposal>) -> Result<()> {
        AdminRemoveProposal::handle(ctx)
    }
}
