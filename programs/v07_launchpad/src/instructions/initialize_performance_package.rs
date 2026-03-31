use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchPerformancePackageInitializedEvent};
use crate::state::{Launch, LaunchState};
use crate::{PRICE_SCALE, TOKENS_TO_PARTICIPANTS};

use price_based_performance_package::program::PriceBasedPerformancePackage;
use price_based_performance_package::{InitializePerformancePackageParams, OracleConfig, Tranche};

#[event_cpi]
#[derive(Accounts)]
pub struct InitializePerformancePackage<'info> {
    #[account(
        mut,
        has_one = launch_base_vault,
        has_one = launch_signer,
        has_one = base_mint,
        constraint = launch.dao == Some(dao.key()) @ LaunchpadError::InvalidDao,
    )]
    pub launch: Box<Account<'info, Launch>>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: just a signer
    pub launch_signer: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = launch_signer,
    )]
    pub launch_base_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut, address = launch.base_mint.key())]
    pub base_mint: Box<Account<'info, Mint>>,

    /// CHECK: this is the DAO account, init by futarchy program
    #[account(address = launch.dao.as_ref().unwrap().key())]
    pub dao: UncheckedAccount<'info>,

    /// CHECK: used for constraints
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_MULTISIG, dao.key().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig: UncheckedAccount<'info>,
    /// CHECK: just a signer
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_VAULT, 0_u8.to_le_bytes().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig_vault: UncheckedAccount<'info>,

    /// CHECK: initialized by price based performance package program
    // #[account(mut, seeds = [b"performance_package", launch_signer.key().as_ref()], bump, seeds::program = price_based_performance_package_program)]
    #[account(mut)]
    pub performance_package: UncheckedAccount<'info>,

    /// CHECK: initialized by price based performance package program
    #[account(mut)]
    pub performance_package_token_account: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub squads_program: Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
    pub price_based_performance_package_program: Program<'info, PriceBasedPerformancePackage>,
    /// CHECK: checked by price based performance package program
    pub price_based_performance_package_event_authority: UncheckedAccount<'info>,
}

impl InitializePerformancePackage<'_> {
    pub fn validate(&self) -> Result<()> {
        require_eq!(
            self.launch.state,
            LaunchState::Complete,
            LaunchpadError::InvalidLaunchState
        );

        require!(
            !self.launch.is_performance_package_initialized,
            LaunchpadError::PerformancePackageAlreadyInitialized
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let launch_key = ctx.accounts.launch.key();
        let launch_signer_seeds = &[
            b"launch_signer",
            launch_key.as_ref(),
            &[ctx.accounts.launch.launch_signer_pda_bump],
        ];
        let launch_signer = &[&launch_signer_seeds[..]];

        let price_1e12 = ((ctx.accounts.launch.total_approved_amount as u128) * PRICE_SCALE)
            / (TOKENS_TO_PARTICIPANTS as u128);

        // TODO: only do this is there exists a performance package config
        ctx.accounts.initialize_performance_package(
            price_1e12,
            ctx.accounts.launch.unix_timestamp_completed.unwrap(),
            launch_signer,
        )?;

        ctx.accounts.launch.is_performance_package_initialized = true;
        ctx.accounts.launch.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(LaunchPerformancePackageInitializedEvent {
            common: CommonFields::new(&clock, ctx.accounts.launch.seq_num),
            launch: ctx.accounts.launch.key(),
            performance_package: ctx.accounts.performance_package.key(),
        });

        Ok(())
    }

    #[inline(never)]
    fn initialize_performance_package(
        &self,
        launch_price_1e12: u128,
        start_unix_timestamp: i64,
        launch_signer: &[&[&[u8]]],
    ) -> Result<()> {
        price_based_performance_package::cpi::initialize_performance_package(
            CpiContext::new_with_signer(
                self.price_based_performance_package_program
                    .to_account_info(),
                price_based_performance_package::cpi::accounts::InitializePerformancePackage {
                    performance_package: self.performance_package.to_account_info(),
                    create_key: self.launch_signer.to_account_info(),
                    token_mint: self.base_mint.to_account_info(),
                    grantor_token_account: self.launch_base_vault.to_account_info(),
                    grantor: self.launch_signer.to_account_info(),
                    payer: self.payer.to_account_info(),
                    system_program: self.system_program.to_account_info(),
                    token_program: self.token_program.to_account_info(),
                    associated_token_program: self.associated_token_program.to_account_info(),
                    event_authority: self
                        .price_based_performance_package_event_authority
                        .to_account_info(),
                    program: self
                        .price_based_performance_package_program
                        .to_account_info(),
                    performance_package_token_vault: self
                        .performance_package_token_account
                        .to_account_info(),
                },
                launch_signer,
            ),
            InitializePerformancePackageParams {
                tranches: vec![
                    Tranche {
                        price_threshold: launch_price_1e12 * 2,
                        token_amount: self.launch.performance_package_token_amount / 5,
                    },
                    Tranche {
                        price_threshold: launch_price_1e12 * 4,
                        token_amount: self.launch.performance_package_token_amount / 5,
                    },
                    Tranche {
                        price_threshold: launch_price_1e12 * 8,
                        token_amount: self.launch.performance_package_token_amount / 5,
                    },
                    Tranche {
                        price_threshold: launch_price_1e12 * 16,
                        token_amount: self.launch.performance_package_token_amount / 5,
                    },
                    Tranche {
                        price_threshold: launch_price_1e12 * 32,
                        token_amount: self.launch.performance_package_token_amount / 5,
                    },
                ],
                min_unlock_timestamp: start_unix_timestamp
                    + (self.launch.months_until_insiders_can_unlock as i64 * 30 * 24 * 60 * 60),
                oracle_config: OracleConfig {
                    oracle_account: self.dao.key(),
                    // 8 bytes for `Dao` discriminator, 1 byte for `PoolState` enum discriminator
                    // spot `Pool` is always first and has the TWAP oracle
                    byte_offset: 8 + 1,
                },
                // 3 month TWAP
                twap_length_seconds: 3 * 30 * 24 * 60 * 60,
                grantee: self.launch.performance_package_grantee,
                performance_package_authority: self.squads_multisig_vault.key(),
            },
        )
    }
}
