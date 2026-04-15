use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

use mint_governor::{
    cpi::{
        accounts::{AddMintAuthority, UpdateMintGovernorAdmin},
        add_mint_authority, update_mint_governor_admin,
    },
    program::MintGovernor as MintGovernorProgram,
    state::MintGovernor,
    AddMintAuthorityArgs,
};

use performance_package_v2::{
    cpi::{
        accounts::InitializePerformancePackage as InitializePerformancePackageCpi,
        initialize_performance_package,
    },
    program::PerformancePackageV2,
    InitializePerformancePackageArgs, OracleReader, RewardFunction, ThresholdTranche,
};

use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchFinalizedEvent};
use crate::state::{Launch, LaunchState};
use crate::{
    PP_NUM_TRANCHES, PP_PRICE_MULTIPLIERS, PP_TWAP_MIN_DURATION, PRICE_SCALE,
    TOKENS_TO_PARTICIPANTS,
};

#[event_cpi]
#[derive(Accounts)]
pub struct FinalizeLaunch<'info> {
    #[account(
        mut,
        has_one = launch_signer,
        has_one = base_mint,
        has_one = mint_governor,
        has_one = performance_package_grantee,
        constraint = launch.dao == Some(dao.key()) @ LaunchpadError::InvalidDao,
    )]
    pub launch: Box<Account<'info, Launch>>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: validated via has_one on launch
    pub launch_signer: UncheckedAccount<'info>,

    #[account(address = launch.base_mint)]
    pub base_mint: Account<'info, Mint>,

    // DAO / Squads
    /// CHECK: validated via constraint on launch.dao
    pub dao: UncheckedAccount<'info>,

    /// CHECK: PDA derived from squads program
    #[account(
        seeds = [
            squads_multisig_program::SEED_PREFIX,
            squads_multisig_program::SEED_MULTISIG,
            dao.key().as_ref(),
        ],
        seeds::program = squads_program,
        bump,
    )]
    pub squads_multisig: UncheckedAccount<'info>,

    /// CHECK: PDA derived from squads program
    #[account(
        seeds = [
            squads_multisig_program::SEED_PREFIX,
            squads_multisig.key().as_ref(),
            squads_multisig_program::SEED_VAULT,
            0_u8.to_le_bytes().as_ref(),
        ],
        seeds::program = squads_program,
        bump,
    )]
    pub squads_multisig_vault: UncheckedAccount<'info>,

    /// CHECK: validated via has_one on launch
    pub performance_package_grantee: UncheckedAccount<'info>,

    // MintGovernor
    #[account(mut)]
    pub mint_governor: Account<'info, MintGovernor>,

    /// CHECK: initialized via CPI
    #[account(
        mut,
        seeds = [b"mint_authority", mint_governor.key().as_ref(), performance_package.key().as_ref()],
        bump,
        seeds::program = mint_governor_program.key(),
    )]
    pub pp_mint_authority: UncheckedAccount<'info>,

    /// CHECK: initialized via CPI
    #[account(
        mut,
        seeds = [b"performance_package", launch_signer.key().as_ref()],
        bump,
        seeds::program = performance_package_v2_program.key(),
    )]
    pub performance_package: UncheckedAccount<'info>,

    // Programs
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub squads_program: Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
    pub mint_governor_program: Program<'info, MintGovernorProgram>,
    /// CHECK: checked by mint_governor program
    pub mint_governor_event_authority: UncheckedAccount<'info>,
    pub performance_package_v2_program: Program<'info, PerformancePackageV2>,
    /// CHECK: checked by performance_package_v2 program
    pub performance_package_v2_event_authority: UncheckedAccount<'info>,
}

impl FinalizeLaunch<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.launch.state == LaunchState::Complete,
            LaunchpadError::InvalidLaunchState
        );
        require!(
            !self.launch.is_finalized,
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
        let signer = &[&launch_signer_seeds[..]];

        let launch_price = (ctx.accounts.launch.total_approved_amount as u128 * PRICE_SCALE)
            / (TOKENS_TO_PARTICIPANTS as u128);

        // Build threshold tranches for PP v2
        let pp_token_amount = ctx.accounts.launch.performance_package_token_amount;
        let mut tranches = Vec::with_capacity(PP_NUM_TRANCHES);
        for (i, multiplier) in PP_PRICE_MULTIPLIERS.iter().enumerate() {
            tranches.push(ThresholdTranche {
                threshold: launch_price * multiplier,
                cumulative_amount: pp_token_amount * (i as u64 + 1) / PP_NUM_TRANCHES as u64,
            });
        }

        // CPI → mint_governor::add_mint_authority
        add_mint_authority(
            CpiContext::new_with_signer(
                ctx.accounts.mint_governor_program.to_account_info(),
                AddMintAuthority {
                    mint_governor: ctx.accounts.mint_governor.to_account_info(),
                    mint_authority: ctx.accounts.pp_mint_authority.to_account_info(),
                    admin: ctx.accounts.launch_signer.to_account_info(),
                    authorized_minter: ctx.accounts.performance_package.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    event_authority: ctx.accounts.mint_governor_event_authority.to_account_info(),
                    program: ctx.accounts.mint_governor_program.to_account_info(),
                },
                signer,
            ),
            AddMintAuthorityArgs {
                max_total: Some(pp_token_amount),
            },
        )?;

        // CPI → performance_package_v2::initialize_performance_package
        let min_unlock_timestamp = ctx.accounts.launch.unix_timestamp_completed.unwrap()
            + (ctx.accounts.launch.months_until_insiders_can_unlock as i64) * 30 * 24 * 60 * 60;

        initialize_performance_package(
            CpiContext::new_with_signer(
                ctx.accounts
                    .performance_package_v2_program
                    .to_account_info(),
                InitializePerformancePackageCpi {
                    performance_package: ctx.accounts.performance_package.to_account_info(),
                    mint: ctx.accounts.base_mint.to_account_info(),
                    mint_governor: ctx.accounts.mint_governor.to_account_info(),
                    mint_authority: ctx.accounts.pp_mint_authority.to_account_info(),
                    create_key: ctx.accounts.launch_signer.to_account_info(),
                    authority: ctx.accounts.squads_multisig_vault.to_account_info(),
                    recipient: ctx.accounts.performance_package_grantee.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    event_authority: ctx
                        .accounts
                        .performance_package_v2_event_authority
                        .to_account_info(),
                    program: ctx
                        .accounts
                        .performance_package_v2_program
                        .to_account_info(),
                },
                signer,
            ),
            InitializePerformancePackageArgs {
                oracle_reader: OracleReader::FutarchyTwap {
                    amm: ctx.accounts.dao.key(),
                    min_duration: PP_TWAP_MIN_DURATION,
                    start_value: 0,
                    start_time: 0,
                    end_value: 0,
                    end_time: 0,
                },
                reward_function: RewardFunction::Threshold { tranches },
                min_unlock_timestamp,
            },
        )?;

        // CPI → mint_governor::update_mint_governor_admin
        update_mint_governor_admin(CpiContext::new_with_signer(
            ctx.accounts.mint_governor_program.to_account_info(),
            UpdateMintGovernorAdmin {
                mint_governor: ctx.accounts.mint_governor.to_account_info(),
                admin: ctx.accounts.launch_signer.to_account_info(),
                new_admin: ctx.accounts.squads_multisig_vault.to_account_info(),
                event_authority: ctx.accounts.mint_governor_event_authority.to_account_info(),
                program: ctx.accounts.mint_governor_program.to_account_info(),
            },
            signer,
        ))?;

        let launch = &mut ctx.accounts.launch;
        launch.is_finalized = true;
        launch.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(LaunchFinalizedEvent {
            common: CommonFields::new(&clock, launch.seq_num),
            launch: launch.key(),
            performance_package: ctx.accounts.performance_package.key(),
            mint_governor: ctx.accounts.mint_governor.key(),
            mint_governor_new_admin: ctx.accounts.squads_multisig_vault.key(),
            pp_mint_authority: ctx.accounts.pp_mint_authority.key(),
        });

        Ok(())
    }
}
