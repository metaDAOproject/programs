use anchor_lang::Discriminator;
use anchor_lang::{prelude::*, system_program};
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::associated_token::{self, AssociatedToken, Create};
use anchor_spl::metadata::UpdateMetadataAccountsV2;
use anchor_spl::token::spl_token::instruction::AuthorityType;
use anchor_spl::token::{self, Mint, MintTo, SetAuthority, Token, TokenAccount, Transfer};
use raydium_cpmm_cpi::states::AMM_CONFIG_SEED;

use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchCompletedEvent};
use crate::state::{Launch, LaunchState};
use crate::AVAILABLE_TOKENS;
use anchor_spl::metadata::{
    mpl_token_metadata::ID as MPL_TOKEN_METADATA_PROGRAM_ID, update_metadata_accounts_v2, Metadata,
};
use raydium_cpmm_cpi::{
    cpi, instruction,
    program::RaydiumCpmm,
    states::{AmmConfig, OBSERVATION_SEED, POOL_LP_MINT_SEED, POOL_VAULT_SEED},
};

use autocrat::program::Autocrat;
use autocrat::InitializeDaoParams;
use autocrat::{DAY_IN_SLOTS};

pub const PRICE_SCALE: u128 = 1_000_000_000_000;

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
        has_one = launch_usdc_vault,
        has_one = launch_token_vault,
        has_one = launch_signer,
        has_one = token_mint,
        has_one = usdc_mint,
    )]
    pub launch: Box<Account<'info, Launch>>,

    /// CHECK: Token metadata
    #[account(
        mut,
        seeds = [b"metadata", MPL_TOKEN_METADATA_PROGRAM_ID.as_ref(), token_mint.key().as_ref()],
        seeds::program = MPL_TOKEN_METADATA_PROGRAM_ID,
        bump
    )]
    pub token_metadata: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: just a signer
    #[account(mut)]
    pub launch_signer: UncheckedAccount<'info>,

    /// CHECK: pool vault and lp mint authority
    #[account(
        seeds = [
            raydium_cpmm_cpi::AUTH_SEED.as_bytes(),
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub authority: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = launch_signer,
    )]
    pub launch_usdc_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = launch_signer,
    )]
    pub launch_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = dao_treasury,
    )]
    pub treasury_usdc_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: pool lp mint not created yet so we can't initialize it before
    #[account(
        mut,
        address = get_associated_token_address(
            dao_treasury.key,
            lp_mint.key,
        )
    )]
    pub treasury_lp_account: UncheckedAccount<'info>,

    /// Use the lowest fee pool, can see fees at https://api-v3.raydium.io/main/cpmm-config
    #[account(
        mut,
        seeds = [
            AMM_CONFIG_SEED.as_bytes(),
            &0_u16.to_be_bytes()
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub amm_config: Box<Account<'info, AmmConfig>>,

    /// CHECK: Initialize an account to store the pool state, init by cp-swap
    #[account(
        mut,
        seeds = [
            b"pool_state",
            dao.key().as_ref(),
        ],
        bump,
    )]
    pub pool_state: UncheckedAccount<'info>,

    #[account(mut)]
    pub token_mint: Box<Account<'info, Mint>>,

    pub usdc_mint: Box<Account<'info, Mint>>,

    /// CHECK: pool lp mint, init by cp-swap
    #[account(
        mut,
        seeds = [
            POOL_LP_MINT_SEED.as_bytes(),
            pool_state.key().as_ref(),
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub lp_mint: UncheckedAccount<'info>,

    /// CHECK: creator lp ATA token account, init by cp-swap
    #[account(mut)]
    pub lp_vault: UncheckedAccount<'info>,

    /// CHECK: Token_0 vault for the pool, init by cp-swap
    #[account(
        mut,
        seeds = [
            POOL_VAULT_SEED.as_bytes(),
            pool_state.key().as_ref(),
            token_mint.key().as_ref()
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub pool_token_vault: UncheckedAccount<'info>,

    /// CHECK: Token_1 vault for the pool, init by cp-swap
    #[account(
        mut,
        seeds = [
            POOL_VAULT_SEED.as_bytes(),
            pool_state.key().as_ref(),
            usdc_mint.key().as_ref()
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub pool_usdc_vault: UncheckedAccount<'info>,

    /// create pool fee account
    #[account(
        mut,
        address = raydium_cpmm_cpi::create_pool_fee_reveiver::id(),
    )]
    pub create_pool_fee: Box<Account<'info, TokenAccount>>,

    /// CHECK: an account to store oracle observations, init by cp-swap
    #[account(
        mut,
        seeds = [
            OBSERVATION_SEED.as_bytes(),
            pool_state.key().as_ref(),
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub observation_state: UncheckedAccount<'info>,

    /// CHECK: this is the DAO account, init by autocrat
    #[account(
        mut,
        seeds = [
            b"launch_dao",
            launch.key().as_ref(),
        ],
        bump,
    )]
    pub dao: UncheckedAccount<'info>,

    /// CHECK: this is the DAO treasury account
    #[account(
        seeds = [
            dao.key().as_ref(),
        ],
        seeds::program = autocrat_program,
        bump,
    )]
    pub dao_treasury: UncheckedAccount<'info>,

    pub cp_swap_program: Program<'info, RaydiumCpmm>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub autocrat_program: Program<'info, Autocrat>,
    pub token_metadata_program: Program<'info, Metadata>,
    /// CHECK: checked by autocrat program
    pub autocrat_event_authority: UncheckedAccount<'info>,
    pub rent: Sysvar<'info, Rent>,
}

impl CompleteLaunch<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        require!(
            self.launch.state == LaunchState::Live,
            LaunchpadError::InvalidLaunchState
        );

        require!(
            clock.unix_timestamp
                >= self
                    .launch
                    .unix_timestamp_started
                    .saturating_add(self.launch.seconds_for_launch.try_into().unwrap()),
            LaunchpadError::LaunchPeriodNotOver
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let launch = &mut ctx.accounts.launch;

        launch.dao = Some(ctx.accounts.dao.key());
        launch.dao_treasury = Some(ctx.accounts.dao_treasury.key());

        let total_committed_amount = launch.total_committed_amount;

        // For the DAO, we want proposals to start at the price of the launch,
        // for the lagging TWAP to be able to move its latest observation by 5%
        // per update (300% per hour), and for proposers to need to lock up 1%
        // of the supply and an equivalent value of USDC.

        let price_1e12 =
            ((total_committed_amount as u128) * PRICE_SCALE) / (AVAILABLE_TOKENS as u128);

        let launch_key = launch.key();

        let seeds = &[b"launch_dao", launch_key.as_ref(), &[ctx.bumps.dao]];
        let signer = &[&seeds[..]];

        if total_committed_amount >= launch.minimum_raise_amount {
            autocrat::cpi::initialize_dao(
                CpiContext::new_with_signer(
                    ctx.accounts.autocrat_program.to_account_info(),
                    autocrat::cpi::accounts::InitializeDao {
                        dao: ctx.accounts.dao.to_account_info(),
                        payer: ctx.accounts.payer.to_account_info(),
                        system_program: ctx.accounts.system_program.to_account_info(),
                        token_mint: ctx.accounts.token_mint.to_account_info(),
                        usdc_mint: ctx.accounts.usdc_mint.to_account_info(),
                        event_authority: ctx.accounts.autocrat_event_authority.to_account_info(),
                        program: ctx.accounts.autocrat_program.to_account_info(),
                    },
                    signer,
                ),
                InitializeDaoParams {
                    twap_initial_observation: price_1e12,
                    twap_max_observation_change_per_update: price_1e12 / 20,
                    min_quote_futarchic_liquidity: total_committed_amount / 100,
                    min_base_futarchic_liquidity: AVAILABLE_TOKENS / 100,
                    pass_threshold_bps: None,
                    slots_per_proposal: Some(3 * DAY_IN_SLOTS),
                    twap_start_delay_slots: DAY_IN_SLOTS,
                },
            )?;

            let usdc_to_lp = total_committed_amount.saturating_div(10);
            let usdc_to_dao = total_committed_amount.saturating_sub(usdc_to_lp);
            let token_to_lp = AVAILABLE_TOKENS / 10;

            let launch_key = launch.key();

            let launch_signer_seeds = &[
                b"launch_signer",
                launch_key.as_ref(),
                &[launch.launch_signer_pda_bump],
            ];
            let launch_signer = &[&launch_signer_seeds[..]];

            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.token_mint.to_account_info(),
                        to: ctx.accounts.launch_token_vault.to_account_info(),
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
                        account_or_mint: ctx.accounts.token_mint.to_account_info(),
                        current_authority: ctx.accounts.launch_signer.to_account_info(),
                    },
                    launch_signer,
                ),
                AuthorityType::MintTokens,
                Some(ctx.accounts.dao_treasury.key()),
            )?;

            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: ctx.accounts.launch_signer.to_account_info(),
                    },
                ),
                // pool fee + 0.1 SOL for rent, we only need 0.05 now but Raydium
                // is upgradeable so I'd rather leave buffer
                ctx.accounts.amm_config.create_pool_fee + 100_000_000,
            )?;

            // Raydium requires that token_0 < token_1
            let (
                token_0_mint,
                token_1_mint,
                token_0_vault,
                token_1_vault,
                creator_token_0,
                creator_token_1,
                init_amount_0,
                init_amount_1,
            ) = if ctx.accounts.token_mint.key() < ctx.accounts.usdc_mint.key() {
                (
                    ctx.accounts.token_mint.to_account_info(),
                    ctx.accounts.usdc_mint.to_account_info(),
                    ctx.accounts.pool_token_vault.to_account_info(),
                    ctx.accounts.pool_usdc_vault.to_account_info(),
                    ctx.accounts.launch_token_vault.to_account_info(),
                    ctx.accounts.launch_usdc_vault.to_account_info(),
                    token_to_lp,
                    usdc_to_lp,
                )
            } else {
                (
                    ctx.accounts.usdc_mint.to_account_info(),
                    ctx.accounts.token_mint.to_account_info(),
                    ctx.accounts.pool_usdc_vault.to_account_info(),
                    ctx.accounts.pool_token_vault.to_account_info(),
                    ctx.accounts.launch_usdc_vault.to_account_info(),
                    ctx.accounts.launch_token_vault.to_account_info(),
                    usdc_to_lp,
                    token_to_lp,
                )
            };

            let cpi_accounts = cpi::accounts::Initialize {
                creator: ctx.accounts.launch_signer.to_account_info(),
                amm_config: ctx.accounts.amm_config.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
                pool_state: ctx.accounts.pool_state.to_account_info(),
                lp_mint: ctx.accounts.lp_mint.to_account_info(),
                creator_lp_token: ctx.accounts.lp_vault.to_account_info(),
                create_pool_fee: ctx.accounts.create_pool_fee.to_account_info(),
                observation_state: ctx.accounts.observation_state.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                token_0_program: ctx.accounts.token_program.to_account_info(),
                token_1_program: ctx.accounts.token_program.to_account_info(),
                associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
                token_0_mint,
                token_1_mint,
                token_0_vault,
                token_1_vault,
                creator_token_0,
                creator_token_1,
            };

            let ix = instruction::Initialize {
                init_amount_0,
                init_amount_1,
                open_time: 0,
            };
            let mut ix_data = Vec::with_capacity(256);
            ix_data.extend_from_slice(&instruction::Initialize::discriminator());
            AnchorSerialize::serialize(&ix, &mut ix_data)?;

            let ix = solana_program::instruction::Instruction {
                program_id: ctx.accounts.cp_swap_program.key(),
                accounts: cpi_accounts
                    .to_account_metas(None)
                    .into_iter()
                    .zip(cpi_accounts.to_account_infos())
                    .map(|mut pair| {
                        pair.0.is_signer = pair.1.is_signer;
                        if pair.0.pubkey == ctx.accounts.launch_signer.key()
                            || pair.0.pubkey == ctx.accounts.pool_state.key()
                        {
                            pair.0.is_signer = true;
                        }
                        pair.0
                    })
                    .collect(),
                data: ix_data,
            };

            let dao_key = ctx.accounts.dao.key();
            let pool_seeds = &[b"pool_state", dao_key.as_ref(), &[ctx.bumps.pool_state]];
            let raydium_signer = &[&launch_signer_seeds[..], &pool_seeds[..]];

            solana_program::program::invoke_signed(
                &ix,
                &cpi_accounts.to_account_infos(),
                raydium_signer,
            )?;

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.launch_usdc_vault.to_account_info(),
                        to: ctx.accounts.treasury_usdc_account.to_account_info(),
                        authority: ctx.accounts.launch_signer.to_account_info(),
                    },
                    launch_signer,
                ),
                usdc_to_dao,
            )?;

            // We don't need to do this idempotently because the LP mint is only
            // created in the Raydium IX, which means that the account couldn't
            // exist yet.
            associated_token::create(CpiContext::new(
                ctx.accounts.associated_token_program.to_account_info(),
                Create {
                    payer: ctx.accounts.payer.to_account_info(),
                    associated_token: ctx.accounts.treasury_lp_account.to_account_info(),
                    authority: ctx.accounts.dao_treasury.to_account_info(),
                    mint: ctx.accounts.lp_mint.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
            ))?;

            let lp_vault = ctx.accounts.lp_vault.to_account_info();
            let lp_vault: TokenAccount =
                TokenAccount::try_deserialize(&mut &lp_vault.data.borrow()[..])?;

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.lp_vault.to_account_info(),
                        to: ctx.accounts.treasury_lp_account.to_account_info(),
                        authority: ctx.accounts.launch_signer.to_account_info(),
                    },
                    launch_signer,
                ),
                lp_vault.amount,
            )?;

            update_metadata_accounts_v2(
                CpiContext::new_with_signer(
                    ctx.accounts.token_metadata_program.to_account_info(),
                    UpdateMetadataAccountsV2 {
                        metadata: ctx.accounts.token_metadata.to_account_info(),
                        update_authority: ctx.accounts.launch_signer.to_account_info(),
                    },
                    launch_signer,
                ),
                Some(ctx.accounts.dao_treasury.key()),
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
            dao_treasury: launch.dao_treasury,
        });

        Ok(())
    }
}
