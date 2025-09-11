use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::UpdateMetadataAccountsV2;
use anchor_spl::token::spl_token::instruction::AuthorityType;
use anchor_spl::token::{self, Mint, MintTo, SetAuthority, Token, TokenAccount, Transfer};

use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchCompletedEvent};
use crate::state::{Launch, LaunchState};
use crate::TOKENS_TO_PARTICIPANTS;
use anchor_spl::metadata::{
    mpl_token_metadata::ID as MPL_TOKEN_METADATA_PROGRAM_ID, update_metadata_accounts_v2, Metadata,
};

use futarchy::program::Futarchy;
use futarchy::{InitialSpendingLimit, InitializeDaoParams, ProvideLiquidityParams};

use price_based_unlock::program::PriceBasedUnlock;
use price_based_unlock::{InitializeLockerParams, OracleConfig};

pub const PRICE_SCALE: u128 = 1_000_000_000_000;

/// Static accounts for completing a launch, used to reduce code duplication
/// and conserve stack space.
#[derive(Accounts)]
pub struct StaticCompleteLaunchAccounts<'info> {
    pub futarchy_program: Program<'info, Futarchy>,
    pub token_metadata_program: Program<'info, Metadata>,
    /// CHECK: checked by autocrat program
    pub autocrat_event_authority: UncheckedAccount<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub squads_program: Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
    /// CHECK: checked by squads multisig program
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_PROGRAM_CONFIG], bump, seeds::program = squads_program)]
    pub squads_program_config: UncheckedAccount<'info>,
    /// CHECK: checked by squads multisig program
    #[account(mut)]
    pub squads_program_config_treasury: UncheckedAccount<'info>,
    pub price_based_unlock_program: Program<'info, PriceBasedUnlock>,
    /// CHECK: checked by price based unlock program
    pub price_based_unlock_event_authority: UncheckedAccount<'info>,
}

/// Completes a launch, which if the minimum raise is met:
/// - Creates a DAO
/// - Mints an additional 1M tokens
/// - Pairs the 1M tokens against 10% of the USDC on Raydium
/// - Transfers 90% of the USDC to the DAO treasury
/// - Transfers mint authority to the DAO treasury
/// - Transfers the LP position to the DAO treasury
/// - Updates the token metadata to point to the DAO treasury as the update authority
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

    /// CHECK: initialized by price based unlock program
    #[account(mut, seeds = [b"locker", launch_signer.key().as_ref()], bump, seeds::program = static_accounts.price_based_unlock_program)]
    pub locker: UncheckedAccount<'info>,

    /// CHECK: initialized by price based unlock program
    #[account(mut, seeds = [b"locker_token_account", locker.key().as_ref()], bump, seeds::program = static_accounts.price_based_unlock_program)]
    pub locker_token_account: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub static_accounts: StaticCompleteLaunchAccounts<'info>,
}

impl CompleteLaunch<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        require!(
            self.launch.state == LaunchState::Live,
            LaunchpadError::InvalidLaunchState
        );

        require_gte!(
            clock.unix_timestamp,
            self.launch
                .unix_timestamp_started
                .saturating_add(self.launch.seconds_for_launch.try_into().unwrap()),
            LaunchpadError::LaunchPeriodNotOver
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
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

        let total_committed_amount = launch.total_committed_amount;

        msg!("total_committed_amount: {}", total_committed_amount);

        // For the DAO, we want proposals to start at the price of the launch,
        // for the lagging TWAP to be able to move its latest observation by 5%
        // per update (300% per hour), and for proposers to need to lock up 1%
        // of the supply and an equivalent value of USDC.

        let price_1e12 =
            ((total_committed_amount as u128) * PRICE_SCALE) / (TOKENS_TO_PARTICIPANTS as u128);

        let usdc_to_lp = total_committed_amount.saturating_div(5);
        let usdc_to_dao = total_committed_amount.saturating_sub(usdc_to_lp);
        let token_to_lp = TOKENS_TO_PARTICIPANTS / 5;

        if total_committed_amount >= launch.minimum_raise_amount {
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
                        futarchy_amm_base_vault: ctx
                            .accounts
                            .futarchy_amm_base_vault
                            .to_account_info(),
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
                    min_quote_futarchic_liquidity: total_committed_amount / 100,
                    min_base_futarchic_liquidity: TOKENS_TO_PARTICIPANTS / 100,
                    pass_threshold_bps: 300,
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
                    },
                    launch_signer,
                ),
                ProvideLiquidityParams {
                    max_base_amount: token_to_lp,
                    quote_amount: usdc_to_lp,
                    min_liquidity: 0,
                    position_authority: ctx.accounts.squads_multisig_vault.key(),
                },
            )?;

            let clock = Clock::get()?;

            price_based_unlock::cpi::initialize_locker(
                CpiContext::new_with_signer(
                    ctx.accounts.static_accounts.price_based_unlock_program.to_account_info(),
                    price_based_unlock::cpi::accounts::InitializeLocker {
                        locker: ctx.accounts.locker.to_account_info(),
                        create_key: ctx.accounts.launch_signer.to_account_info(),
                        token_mint: ctx.accounts.base_mint.to_account_info(),
                        from_token_account: ctx.accounts.launch_base_vault.to_account_info(),
                        token_authority: ctx.accounts.launch_signer.to_account_info(),
                        payer: ctx.accounts.payer.to_account_info(),
                        system_program: ctx.accounts.system_program.to_account_info(),
                        token_program: ctx.accounts.token_program.to_account_info(),
                        associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
                        event_authority: ctx.accounts.static_accounts.price_based_unlock_event_authority.to_account_info(),
                        program: ctx.accounts.static_accounts.price_based_unlock_program.to_account_info(),
                        locker_token_account: ctx.accounts.locker_token_account.to_account_info(),
                    }, launch_signer),
                    InitializeLockerParams {
                        price_threshold: launch.price_based_unlock_threshold,
                        token_amount: launch.price_based_premine_amount,
                        unlock_timestamp: clock.unix_timestamp + 60 * 60 * 24,
                        oracle_config: OracleConfig {
                            oracle_account: ctx.accounts.dao.key(),
                            // 8 bytes for `Dao` discriminator, 1 byte for `PoolState` enum discriminator
                            // spot `Pool` is always first and has the TWAP oracle
                            byte_offset: 8 + 1,
                        },
                        twap_length_seconds: 300,
                        beneficiary: launch.price_based_unlock_recipient,
                        locker_authority: ctx.accounts.squads_multisig_vault.key(),
                    },
            )?;

            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.base_mint.to_account_info(),
                        to: ctx.accounts.launch_base_vault.to_account_info(),
                        authority: ctx.accounts.launch_signer.to_account_info(),
                    },
                    launch_signer,
                ),
                token_to_lp,
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
        } else {
            launch.state = LaunchState::Refunding;
        }

        launch.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(LaunchCompletedEvent {
            common: CommonFields::new(&clock, launch.seq_num),
            launch: launch.key(),
            final_state: launch.state,
            total_committed: launch.total_committed_amount,
            dao: launch.dao,
            dao_treasury: launch.dao_vault,
        });

        Ok(())
    }
}
