//! The orchestrator of a futarchy. Equivalent to the 'governor' of Compound's
//! governance system.
//!
//! Autocrat has two types of accounts: DAOs and proposals. Every DAO has its
//! own token, its own treasury account, and list of configs. Proposals are
//! created for a specific DAO, and contain an SVM instruction and a URL that
//! should point to a description and justification of that instruction.
//!
//! Proposals pass through various states in their lifecycle. Here's a description
//! of these states:
//! - Pre-creation: this is when you initialize the accounts needed for a proposal,
//!   including the vaults and the AMM accounts. The proposer will also deposit to
//!   create their LP during this time.
//! - Trading: to create a proposal, the proposer must call
//!   `initialize_proposal`, which requires them to lock up some LP tokens in each
//!   of the markets. Once a proposal is created, anyone can trade its markets.
//!   Prices of these markets are aggregated into a time-weighted average price
//!   oracle.
//! - Pass or fail: if the TWAP of the pass market is sufficiently higher than the
//!   TWAP of the fail market, the proposal will pass. If it's not, the proposal will
//!   fail. If it passes, both vaults will be finalized, allowing pTOKEN holders to
//!   redeem. If it fails, both vaults will be reverted, allowing fTOKEN holders to
//!   redeem.
//! - Executed: if a proposal passes, anyone can make autocrat execute its SVM
//!   instruction by calling `execute_proposal`.
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use conditional_vault::program::ConditionalVault as ConditionalVaultProgram;
use conditional_vault::ConditionalVault as ConditionalVaultAccount;
use conditional_vault::Question;

pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

pub use error::AutocratError;
pub use events::*;
pub use instructions::*;
pub use state::*;

use amm::state::Amm;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "autocrat",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/futarchy",
    source_release: "v0.5.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("auToUr3CQza3D4qreT6Std2MTomfzvrEeCC5qh7ivW5");

pub const SLOTS_PER_10_SECS: u64 = 25;
pub const DAY_IN_SLOTS: u64 = 24 * 60 * 6 * SLOTS_PER_10_SECS;
pub const THREE_DAYS_IN_SLOTS: u64 = 3 * DAY_IN_SLOTS;

pub const TEN_DAYS_IN_SECONDS: i64 = 10 * 24 * 60 * 60;

// by default, the pass price needs to be 3% higher than the fail price
pub const DEFAULT_PASS_THRESHOLD_BPS: u16 = 300;

// MetaDAO takes 0.2%, LP takes 0.4%
pub const LP_TAKER_FEE_BPS: u16 = 40;
pub const PROTOCOL_TAKER_FEE_BPS: u16 = 20;
pub const MAX_BPS: u16 = 10_000;

// the index of the fail and pass outcomes in the question and the index of
// the pass and fail conditional tokens in the conditional vault
pub const FAIL_INDEX: usize = 0;
pub const PASS_INDEX: usize = 1;

// TWAP can only move by $5 per slot
pub const DEFAULT_MAX_OBSERVATION_CHANGE_PER_UPDATE_LOTS: u64 = 5_000;

#[program]
pub mod autocrat {
    use super::*;

    /// TODO:
    /// - Collect taker fees
    /// - Collect self-arbitrage profits in tokens not used
    /// - Allow people to withdraw liquidity
    /// - Allow protocol treasury to collect fees
    /// - Enable staking to proposals
    /// - Switch proposal to use Futarchy AMM
    /// - Add TWAPs

    pub fn initialize_dao(ctx: Context<InitializeDao>, params: InitializeDaoParams) -> Result<()> {
        InitializeDao::handle(ctx, params)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn initialize_proposal(
        ctx: Context<InitializeProposal>,
        params: InitializeProposalParams,
    ) -> Result<()> {
        InitializeProposal::handle(ctx, params)
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

    pub fn conditional_swap(ctx: Context<ConditionalSwap>, params: ConditionalSwapParams) -> Result<()> {
        ConditionalSwap::handle(ctx, params)
    }

    pub fn initialize_futarchy_amm(ctx: Context<InitializeFutarchyAmm>) -> Result<()> {
        InitializeFutarchyAmm::handle(ctx)
    }

    pub fn provide_liquidity(ctx: Context<ProvideLiquidity>, params: ProvideLiquidityParams) -> Result<()> {
        ProvideLiquidity::handle(ctx, params)
    }
}
