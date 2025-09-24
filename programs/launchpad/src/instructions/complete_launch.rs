use anchor_lang::{prelude::*, system_program};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::UpdateMetadataAccountsV2;
use anchor_spl::token::spl_token::instruction::AuthorityType;
use anchor_spl::token::{self, Mint, SetAuthority, Token, TokenAccount, Transfer};
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface;
// use damm_v2_cpi::constants::seeds::{
//     POOL_AUTHORITY_PREFIX, POOL_PREFIX, POSITION_NFT_ACCOUNT_PREFIX, POSITION_PREFIX,
//     TOKEN_VAULT_PREFIX,
// };
use damm_v2_cpi::constants::MAX_SQRT_PRICE;
use damm_v2_cpi::BaseFeeParameters;

use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchCompletedEvent};
use crate::state::{Launch, LaunchState};
use crate::{
    TOKENS_TO_DAMM_V2_LIQUIDITY_UNSCALED, TOKENS_TO_FUTARCHY_LIQUIDITY, TOKENS_TO_PARTICIPANTS,
    TOKEN_SCALE,
};
use anchor_spl::metadata::{
    mpl_token_metadata::ID as MPL_TOKEN_METADATA_PROGRAM_ID, update_metadata_accounts_v2, Metadata,
};

use futarchy::program::Futarchy;
use futarchy::{InitialSpendingLimit, InitializeDaoParams, ProvideLiquidityParams};

use price_based_performance_package::program::PriceBasedPerformancePackage;
use price_based_performance_package::{InitializePerformancePackageParams, OracleConfig, Tranche};

use damm_v2_cpi::program::DammV2Cpi;

pub const PRICE_SCALE: u128 = 1_000_000_000_000;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct CompleteLaunchArgs {
    pub final_raise_amount: Option<u64>,
}

/// Static accounts for completing a launch, used to reduce code duplication
/// and conserve stack space.
#[derive(Accounts)]
pub struct StaticCompleteLaunchAccounts<'info> {
    pub futarchy_program: Program<'info, Futarchy>,
    pub token_metadata_program: Program<'info, Metadata>,
    /// CHECK: checked by autocrat program
    pub autocrat_event_authority: UncheckedAccount<'info>,
    pub squads_program: Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
    /// CHECK: checked by squads multisig program
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_PROGRAM_CONFIG], bump, seeds::program = squads_program)]
    pub squads_program_config: UncheckedAccount<'info>,
    /// CHECK: checked by squads multisig program
    #[account(mut)]
    pub squads_program_config_treasury: UncheckedAccount<'info>,
    pub price_based_performance_package_program: Program<'info, PriceBasedPerformancePackage>,
    /// CHECK: checked by price based performance package program
    pub price_based_performance_package_event_authority: UncheckedAccount<'info>,
}

// pub fn max_key(left: &Pubkey, right: &Pubkey) -> [u8; 32] {
//     std::cmp::max(left, right).to_bytes()
// }

// pub fn min_key(left: &Pubkey, right: &Pubkey) -> [u8; 32] {
//     std::cmp::min(left, right).to_bytes()
// }

#[derive(Accounts)]
pub struct MeteoraAccounts<'info> {
    pub damm_v2_program: Program<'info, DammV2Cpi>,
    /// CHECK: checked by damm v2 program
    pub config: UncheckedAccount<'info>,

    pub token_2022_program: Program<'info, Token2022>,

    /// CHECK: checked by damm v2 program
    // #[account(mut, seeds = [POSITION_NFT_ACCOUNT_PREFIX.as_ref(), position_nft_mint.key().as_ref()], bump, seeds::program = damm_v2_program)]
    #[account(mut)]
    pub position_nft_account: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    // #[account(mut, seeds = [
    //     POOL_PREFIX.as_ref(),
    //     config.key().as_ref(),
    //     &max_key(&base_mint.key(), &quote_mint.key()),
    //     &min_key(&base_mint.key(), &quote_mint.key()),
    // ], bump, seeds::program = damm_v2_program)]
    #[account(mut)]
    pub pool: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    // #[account(mut, seeds = [POSITION_PREFIX.as_ref(), position_nft_mint.key().as_ref()], bump, seeds::program = damm_v2_program)]
    #[account(mut)]
    pub position: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    // #[account(mut, seeds = [
    //     TOKEN_VAULT_PREFIX.as_ref(),
    //     base_mint.key().as_ref(),
    //     pool.key().as_ref(),
    // ], bump, seeds::program = damm_v2_program)]
    #[account(mut)]
    pub token_a_vault: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    // #[account(mut, seeds = [
    //     TOKEN_VAULT_PREFIX.as_ref(),
    //     quote_mint.key().as_ref(),
    //     pool.key().as_ref(),
    // ], bump, seeds::program = damm_v2_program)]
    #[account(mut)]
    pub token_b_vault: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(seeds = [b"damm_pool_creator_authority"], bump)]
    pub pool_creator_authority: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    // #[account(seeds = [POOL_AUTHORITY_PREFIX.as_ref()], bump, seeds::program = damm_v2_program)]
    pub pool_authority: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    pub damm_v2_event_authority: UncheckedAccount<'info>,
}

#[event_cpi]
#[derive(Accounts)]
pub struct CompleteLaunch<'info> {
    #[account(
        mut,
        has_one = launch_quote_vault,
        has_one = launch_base_vault,
        has_one = launch_signer,
        has_one = base_mint,
        has_one = quote_mint,
    )]
    pub launch: Box<Account<'info, Launch>>,

    pub launch_authority: Option<Signer<'info>>,

    /// CHECK: Token metadata
    #[account(
        mut,
        seeds = [b"metadata", MPL_TOKEN_METADATA_PROGRAM_ID.as_ref(), base_mint.key().as_ref()],
        seeds::program = MPL_TOKEN_METADATA_PROGRAM_ID,
        bump
    )]
    pub token_metadata: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: just a signer
    #[account(mut)]
    pub launch_signer: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = launch_signer,
    )]
    pub launch_quote_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = launch_signer,
    )]
    pub launch_base_vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: checked by damm v2 program
    #[account(mut, seeds = [b"position_nft_mint", base_mint.key().as_ref()], bump)]
    pub position_nft_mint: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = quote_mint,
        associated_token::authority = squads_multisig_vault,
    )]
    pub treasury_quote_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub base_mint: Box<Account<'info, Mint>>,

    pub quote_mint: Box<Account<'info, Mint>>,

    /// CHECK: init by autocrat
    #[account(mut, seeds = [b"amm_position", dao.key().as_ref(), squads_multisig_vault.key().as_ref()], bump, seeds::program = static_accounts.futarchy_program)]
    pub dao_owned_lp_position: UncheckedAccount<'info>,

    /// CHECK: checked by autocrat
    #[account(mut)]
    pub futarchy_amm_base_vault: UncheckedAccount<'info>,

    /// CHECK: checked by autocrat
    #[account(mut)]
    pub futarchy_amm_quote_vault: UncheckedAccount<'info>,

    /// CHECK: this is the DAO account, init by autocrat
    #[account(mut)]
    pub dao: UncheckedAccount<'info>,

    /// CHECK: checked by autocrat program
    #[account(mut, seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_MULTISIG, dao.key().as_ref()], bump, seeds::program = static_accounts.squads_program)]
    pub squads_multisig: UncheckedAccount<'info>,
    /// CHECK: just a signer
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_VAULT, 0_u8.to_le_bytes().as_ref()], bump, seeds::program = static_accounts.squads_program)]
    pub squads_multisig_vault: UncheckedAccount<'info>,
    /// CHECK: initialized by squads
    #[account(mut, seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_SPENDING_LIMIT, dao.key().as_ref()], bump, seeds::program = static_accounts.squads_program)]
    pub spending_limit: UncheckedAccount<'info>,

    /// CHECK: initialized by price based performance package program
    // #[account(mut, seeds = [b"performance_package", launch_signer.key().as_ref()], bump, seeds::program = static_accounts.price_based_performance_package_program)]
    #[account(mut)]
    pub performance_package: UncheckedAccount<'info>,

    /// CHECK: initialized by price based performance package program
    #[account(mut)]
    pub performance_package_token_account: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub static_accounts: StaticCompleteLaunchAccounts<'info>,
    pub meteora_accounts: MeteoraAccounts<'info>,
}

impl CompleteLaunch<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        require_eq!(
            self.launch.state,
            LaunchState::Closed,
            LaunchpadError::InvalidLaunchState
        );

        // if the launch was closed within 2 days, the launch authority must be the one
        // to complete the launch
        let two_days_after_close = self.launch.unix_timestamp_closed.unwrap() + 60 * 60 * 24 * 2;
        if two_days_after_close > clock.unix_timestamp {
            if self.launch_authority.is_none() {
                msg!("Launch authority must complete launch until unix timestamp {}. Current time is {}.", two_days_after_close, clock.unix_timestamp);
                return Err(LaunchpadError::LaunchAuthorityNotSet.into());
            }
        }

        if self.launch_authority.is_some() {
            require_keys_eq!(
                self.launch_authority.as_ref().unwrap().key(),
                self.launch.launch_authority,
                LaunchpadError::LaunchAuthorityNotSet
            );
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: CompleteLaunchArgs) -> Result<()> {
        let CompleteLaunchArgs { final_raise_amount } = args;

        // if the launch authority has provided a final raise amount, use it.
        // else, if either they haven't provided a final raise amount or it was
        // completed permissionlessly, use the total committed amount
        let final_raise_amount =
            if final_raise_amount.is_some() && ctx.accounts.launch_authority.is_some() {
                final_raise_amount.unwrap()
            } else {
                ctx.accounts.launch.total_committed_amount
            };

        require_gte!(
            final_raise_amount,
            ctx.accounts.launch.minimum_raise_amount,
            LaunchpadError::FinalRaiseAmountTooLow
        );

        let launch = &mut ctx.accounts.launch;

        launch.dao = Some(ctx.accounts.dao.key());
        launch.dao_vault = Some(ctx.accounts.squads_multisig_vault.key());

        let launch_key = launch.key();
        let launch_signer_seeds = &[
            b"launch_signer",
            launch_key.as_ref(),
            &[launch.launch_signer_pda_bump],
        ];
        let launch_signer = &[&launch_signer_seeds[..]];

        // For the DAO, we want proposals to start at the price of the launch,
        // for the lagging TWAP to be able to move its latest observation by 5%
        // per update (300% per hour), and for proposers to need to lock up 1%
        // of the supply and an equivalent value of USDC.

        let price_1e12 =
            ((final_raise_amount as u128) * PRICE_SCALE) / (TOKENS_TO_PARTICIPANTS as u128);

        let usdc_to_lp = final_raise_amount.saturating_div(5);
        let usdc_to_dao = final_raise_amount.saturating_sub(usdc_to_lp);

        futarchy::cpi::initialize_dao(
            CpiContext::new_with_signer(
                ctx.accounts
                    .static_accounts
                    .futarchy_program
                    .to_account_info(),
                futarchy::cpi::accounts::InitializeDao {
                    dao: ctx.accounts.dao.to_account_info(),
                    dao_creator: ctx.accounts.launch_signer.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    base_mint: ctx.accounts.base_mint.to_account_info(),
                    quote_mint: ctx.accounts.quote_mint.to_account_info(),
                    event_authority: ctx
                        .accounts
                        .static_accounts
                        .autocrat_event_authority
                        .to_account_info(),
                    program: ctx
                        .accounts
                        .static_accounts
                        .futarchy_program
                        .to_account_info(),
                    squads_multisig: ctx.accounts.squads_multisig.to_account_info(),
                    squads_multisig_vault: ctx.accounts.squads_multisig_vault.to_account_info(),
                    squads_program: ctx
                        .accounts
                        .static_accounts
                        .squads_program
                        .to_account_info(),
                    squads_program_config: ctx
                        .accounts
                        .static_accounts
                        .squads_program_config
                        .to_account_info(),
                    squads_program_config_treasury: ctx
                        .accounts
                        .static_accounts
                        .squads_program_config_treasury
                        .to_account_info(),
                    spending_limit: ctx.accounts.spending_limit.to_account_info(),
                    futarchy_amm_base_vault: ctx.accounts.futarchy_amm_base_vault.to_account_info(),
                    futarchy_amm_quote_vault: ctx
                        .accounts
                        .futarchy_amm_quote_vault
                        .to_account_info(),
                    associated_token_program: ctx
                        .accounts
                        .associated_token_program
                        .to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
                launch_signer,
            ),
            InitializeDaoParams {
                twap_initial_observation: price_1e12,
                twap_max_observation_change_per_update: price_1e12 / 20,
                // We're providing liquidity, so that can be used for proposals
                min_quote_futarchic_liquidity: 0,
                min_base_futarchic_liquidity: 0,
                pass_threshold_bps: 150,
                base_to_stake: TOKENS_TO_PARTICIPANTS / 100,
                seconds_per_proposal: 3 * 24 * 60 * 60,
                twap_start_delay_seconds: 24 * 60 * 60,
                nonce: 0,
                initial_spending_limit: Some(InitialSpendingLimit {
                    amount_per_month: launch.monthly_spending_limit_amount,
                    members: launch.monthly_spending_limit_members.clone(),
                }),
            },
        )?;

        futarchy::cpi::provide_liquidity(
            CpiContext::new_with_signer(
                ctx.accounts
                    .static_accounts
                    .futarchy_program
                    .to_account_info(),
                futarchy::cpi::accounts::ProvideLiquidity {
                    dao: ctx.accounts.dao.to_account_info(),
                    liquidity_provider: ctx.accounts.launch_signer.to_account_info(),
                    liquidity_provider_base_account: ctx
                        .accounts
                        .launch_base_vault
                        .to_account_info(),
                    liquidity_provider_quote_account: ctx
                        .accounts
                        .launch_quote_vault
                        .to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    amm_base_vault: ctx.accounts.futarchy_amm_base_vault.to_account_info(),
                    amm_quote_vault: ctx.accounts.futarchy_amm_quote_vault.to_account_info(),
                    amm_position: ctx.accounts.dao_owned_lp_position.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    program: ctx
                        .accounts
                        .static_accounts
                        .futarchy_program
                        .to_account_info(),
                    event_authority: ctx
                        .accounts
                        .static_accounts
                        .autocrat_event_authority
                        .to_account_info(),
                },
                launch_signer,
            ),
            ProvideLiquidityParams {
                max_base_amount: TOKENS_TO_FUTARCHY_LIQUIDITY,
                quote_amount: usdc_to_lp,
                min_liquidity: 0,
                position_authority: ctx.accounts.squads_multisig_vault.key(),
            },
        )?;

        let clock = Box::new(Clock::get()?);

        price_based_performance_package::cpi::initialize_performance_package(
            CpiContext::new_with_signer(
                ctx.accounts
                    .static_accounts
                    .price_based_performance_package_program
                    .to_account_info(),
                price_based_performance_package::cpi::accounts::InitializePerformancePackage {
                    performance_package: ctx.accounts.performance_package.to_account_info(),
                    create_key: ctx.accounts.launch_signer.to_account_info(),
                    token_mint: ctx.accounts.base_mint.to_account_info(),
                    grantor_token_account: ctx.accounts.launch_base_vault.to_account_info(),
                    grantor: ctx.accounts.launch_signer.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    associated_token_program: ctx
                        .accounts
                        .associated_token_program
                        .to_account_info(),
                    event_authority: ctx
                        .accounts
                        .static_accounts
                        .price_based_performance_package_event_authority
                        .to_account_info(),
                    program: ctx
                        .accounts
                        .static_accounts
                        .price_based_performance_package_program
                        .to_account_info(),
                    performance_package_token_vault: ctx
                        .accounts
                        .performance_package_token_account
                        .to_account_info(),
                },
                launch_signer,
            ),
            InitializePerformancePackageParams {
                tranches: vec![
                    Tranche {
                        price_threshold: price_1e12 * 2,
                        token_amount: launch.performance_package_token_amount / 5,
                    },
                    Tranche {
                        price_threshold: price_1e12 * 4,
                        token_amount: launch.performance_package_token_amount / 5,
                    },
                    Tranche {
                        price_threshold: price_1e12 * 8,
                        token_amount: launch.performance_package_token_amount / 5,
                    },
                    Tranche {
                        price_threshold: price_1e12 * 16,
                        token_amount: launch.performance_package_token_amount / 5,
                    },
                    Tranche {
                        price_threshold: price_1e12 * 32,
                        token_amount: launch.performance_package_token_amount / 5,
                    },
                ],
                min_unlock_timestamp: clock.unix_timestamp
                    + (launch.months_until_insiders_can_unlock as i64 * 30 * 24 * 60 * 60),
                oracle_config: OracleConfig {
                    oracle_account: ctx.accounts.dao.key(),
                    // 8 bytes for `Dao` discriminator, 1 byte for `PoolState` enum discriminator
                    // spot `Pool` is always first and has the TWAP oracle
                    byte_offset: 8 + 1,
                },
                // 3 month TWAP
                twap_length_seconds: 3 * 30 * 24 * 60 * 60,
                grantee: launch.performance_package_grantee,
                performance_package_authority: ctx.accounts.squads_multisig_vault.key(),
            },
        )?;

        let base_mint_key = ctx.accounts.base_mint.key();
        let position_nft_mint_signer_seeds = &[
            b"position_nft_mint".as_ref(),
            base_mint_key.as_ref(),
            &[ctx.bumps.position_nft_mint],
        ];

        let pool_creator_authority_signer_seeds = &[
            b"damm_pool_creator_authority".as_ref(),
            &[ctx.bumps.meteora_accounts.pool_creator_authority],
        ];

        let pool_init_signer = &[
            &launch_signer_seeds[..],
            &position_nft_mint_signer_seeds[..],
            &pool_creator_authority_signer_seeds[..],
        ];

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.launch_signer.to_account_info(),
                },
            ),
            50_000_000,
        )?;

        require_eq!(
            ctx.accounts.base_mint.decimals,
            6,
            LaunchpadError::InvariantViolated
        );
        require_eq!(
            ctx.accounts.quote_mint.decimals,
            6,
            LaunchpadError::InvariantViolated
        );

        // ref: https://github.com/MeteoraAg/damm-v2-sdk/blob/3d740ea8434af20a024d5d6fd08d60792dca9ca4/src/helpers/utils.ts#L121-L133
        let float_price = final_raise_amount as f64 / TOKENS_TO_PARTICIPANTS as f64;
        let sqrt_price = (float_price.sqrt() * 2_f64.powf(64.0)) as u128;

        // ref: https://github.com/MeteoraAg/damm-v2-sdk/blob/3d740ea8434af20a024d5d6fd08d60792dca9ca4/src/helpers/curve.ts#L36-L45
        // do it this way to avoid overflow
        let liquidity = ((MAX_SQRT_PRICE * TOKENS_TO_DAMM_V2_LIQUIDITY_UNSCALED as u128)
            / (MAX_SQRT_PRICE - sqrt_price))
            * TOKEN_SCALE as u128
            * sqrt_price;

        damm_v2_cpi::cpi::initialize_pool_with_dynamic_config(
            CpiContext::new_with_signer(
                ctx.accounts
                    .meteora_accounts
                    .damm_v2_program
                    .to_account_info(),
                damm_v2_cpi::cpi::accounts::InitializePoolWithDynamicConfigCtx {
                    creator: ctx.accounts.squads_multisig_vault.to_account_info(),
                    position_nft_mint: ctx.accounts.position_nft_mint.to_account_info(),
                    position_nft_account: ctx
                        .accounts
                        .meteora_accounts
                        .position_nft_account
                        .to_account_info(),
                    payer: ctx.accounts.launch_signer.to_account_info(),
                    pool_creator_authority: ctx
                        .accounts
                        .meteora_accounts
                        .pool_creator_authority
                        .to_account_info(),
                    config: ctx.accounts.meteora_accounts.config.to_account_info(),
                    pool_authority: ctx
                        .accounts
                        .meteora_accounts
                        .pool_authority
                        .to_account_info(),
                    token_a_vault: ctx
                        .accounts
                        .meteora_accounts
                        .token_a_vault
                        .to_account_info(),
                    token_b_vault: ctx
                        .accounts
                        .meteora_accounts
                        .token_b_vault
                        .to_account_info(),
                    payer_token_a: ctx.accounts.launch_base_vault.to_account_info(),
                    payer_token_b: ctx.accounts.launch_quote_vault.to_account_info(),
                    token_a_program: ctx.accounts.token_program.to_account_info(),
                    token_b_program: ctx.accounts.token_program.to_account_info(),
                    token_2022_program: ctx
                        .accounts
                        .meteora_accounts
                        .token_2022_program
                        .to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    pool: ctx.accounts.meteora_accounts.pool.to_account_info(),
                    position: ctx.accounts.meteora_accounts.position.to_account_info(),
                    token_a_mint: ctx.accounts.base_mint.to_account_info(),
                    token_b_mint: ctx.accounts.quote_mint.to_account_info(),
                    event_authority: ctx
                        .accounts
                        .meteora_accounts
                        .damm_v2_event_authority
                        .to_account_info(),
                    program: ctx
                        .accounts
                        .meteora_accounts
                        .damm_v2_program
                        .to_account_info(),
                },
                pool_init_signer,
            ),
            damm_v2_cpi::InitializeCustomizablePoolParameters {
                pool_fees: damm_v2_cpi::PoolFeeParameters {
                    base_fee: BaseFeeParameters {
                        cliff_fee_numerator: 5000000,
                        number_of_period: 0,
                        period_frequency: 0,
                        reduction_factor: 0,
                        fee_scheduler_mode: 0,
                    },
                    padding: [0; 3],
                    dynamic_fee: None,
                },
                activation_point: None,
                activation_type: 0,
                collect_fee_mode: 0,
                sqrt_min_price: sqrt_price,
                sqrt_max_price: MAX_SQRT_PRICE,
                has_alpha_vault: false,
                liquidity,
                sqrt_price,
            },
        )?;

        token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    account_or_mint: ctx.accounts.base_mint.to_account_info(),
                    current_authority: ctx.accounts.launch_signer.to_account_info(),
                },
                launch_signer,
            ),
            AuthorityType::MintTokens,
            Some(ctx.accounts.squads_multisig_vault.key()),
        )?;

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.launch_quote_vault.to_account_info(),
                    to: ctx.accounts.treasury_quote_account.to_account_info(),
                    authority: ctx.accounts.launch_signer.to_account_info(),
                },
                launch_signer,
            ),
            usdc_to_dao,
        )?;

        update_metadata_accounts_v2(
            CpiContext::new_with_signer(
                ctx.accounts
                    .static_accounts
                    .token_metadata_program
                    .to_account_info(),
                UpdateMetadataAccountsV2 {
                    metadata: ctx.accounts.token_metadata.to_account_info(),
                    update_authority: ctx.accounts.launch_signer.to_account_info(),
                },
                launch_signer,
            ),
            Some(ctx.accounts.squads_multisig_vault.key()),
            None,
            None,
            None,
        )?;

        launch.state = LaunchState::Complete;
        launch.final_raise_amount = Some(final_raise_amount);
        launch.seq_num += 1;

        emit_cpi!(LaunchCompletedEvent {
            common: CommonFields::new(&clock, launch.seq_num),
            launch: launch.key(),
            final_state: launch.state,
            total_committed: launch.total_committed_amount,
            dao: launch.dao,
            dao_treasury: launch.dao_vault,
        });

        let refundable_usdc = launch.total_committed_amount - final_raise_amount;

        ctx.accounts.verify_position_nft()?;
        ctx.accounts.verify_vaults(refundable_usdc)?;

        Ok(())
    }

    fn verify_vaults(&mut self, refundable_usdc: u64) -> Result<()> {
        self.launch_base_vault.reload()?;
        self.launch_quote_vault.reload()?;

        require_gte!(
            self.launch_base_vault.amount,
            TOKENS_TO_PARTICIPANTS,
            LaunchpadError::InvariantViolated
        );
        require_gte!(
            self.launch_quote_vault.amount,
            refundable_usdc,
            LaunchpadError::InvariantViolated
        );

        Ok(())
    }

    fn verify_position_nft(&self) -> Result<()> {
        let position_nft_account = token_interface::TokenAccount::try_deserialize(
            &mut &self.meteora_accounts.position_nft_account.data.borrow()[..],
        )?;
        require_eq!(
            position_nft_account.amount,
            1,
            LaunchpadError::InvariantViolated
        );
        require_keys_eq!(
            position_nft_account.owner,
            self.squads_multisig_vault.key(),
            LaunchpadError::InvariantViolated
        );
        Ok(())
    }
}
