use anchor_lang::prelude::*;
use anchor_spl::associated_token::{get_associated_token_address, AssociatedToken};
use anchor_spl::metadata::{
    mpl_token_metadata::ID as MPL_TOKEN_METADATA_PROGRAM_ID, update_metadata_accounts_v2, Metadata,
    UpdateMetadataAccountsV2,
};
use anchor_spl::token::{
    self, spl_token::instruction::AuthorityType, Mint, SetAuthority, Token, TokenAccount, Transfer,
};

use futarchy::program::Futarchy;
use futarchy::{
    InitialSpendingLimit, InitializeDaoParams, ProvideLiquidityParams, SEED_AMM_POSITION, SEED_DAO,
};

use crate::error::RelaunchError;
use crate::events::{CommonFields, RelaunchCompletedEvent};
use crate::state::{Relaunch, RelaunchState};
use crate::{
    usdc_mint, PRICE_SCALE, PROPOSAL_MIN_STAKE_TOKENS, TOKENS_TO_DEPOSITORS,
    TOKENS_TO_FUTARCHY_LIQUIDITY,
};

#[event_cpi]
#[derive(Accounts)]
pub struct CompleteRelaunch<'info> {
    #[account(
        mut,
        has_one = relaunch_signer,
        has_one = new_mint,
        has_one = new_token_vault,
        has_one = usdc_vault,
    )]
    pub relaunch: Box<Account<'info, Relaunch>>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: the vault authority; signs the futarchy CPIs and the authority
    /// handoffs.
    pub relaunch_signer: UncheckedAccount<'info>,

    /// The DAO's base mint; its mint authority moves to the Squads vault.
    #[account(mut)]
    pub new_mint: Box<Account<'info, Mint>>,

    /// The DAO's quote mint.
    #[account(address = usdc_mint::id())]
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub new_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub usdc_vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: the new token's metadata; its update authority moves to the
    /// Squads vault.
    #[account(
        mut,
        seeds = [b"metadata", MPL_TOKEN_METADATA_PROGRAM_ID.as_ref(), new_mint.key().as_ref()],
        seeds::program = MPL_TOKEN_METADATA_PROGRAM_ID,
        bump
    )]
    pub token_metadata: UncheckedAccount<'info>,

    /// CHECK: initialized by the futarchy program; the nonce seed matches the
    /// hardcoded `nonce: 0` CPI param.
    #[account(
        mut,
        seeds = [SEED_DAO, relaunch_signer.key().as_ref(), 0_u64.to_le_bytes().as_ref()],
        bump,
        seeds::program = futarchy_program,
    )]
    pub dao: UncheckedAccount<'info>,

    /// CHECK: initialized by the futarchy program; the DAO's AMM base ATA.
    #[account(mut, address = get_associated_token_address(&dao.key(), &new_mint.key()))]
    pub futarchy_amm_base_vault: UncheckedAccount<'info>,

    /// CHECK: initialized by the futarchy program; the DAO's AMM quote ATA.
    #[account(mut, address = get_associated_token_address(&dao.key(), &usdc_mint.key()))]
    pub futarchy_amm_quote_vault: UncheckedAccount<'info>,

    /// CHECK: initialized by the futarchy program; the Squads-vault-owned LP
    /// position.
    #[account(
        mut,
        seeds = [SEED_AMM_POSITION, dao.key().as_ref(), squads_multisig_vault.key().as_ref()],
        bump,
        seeds::program = futarchy_program,
    )]
    pub amm_position: UncheckedAccount<'info>,

    /// CHECK: initialized by squads via the futarchy CPI.
    #[account(
        mut,
        seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_MULTISIG, dao.key().as_ref()],
        bump,
        seeds::program = squads_program,
    )]
    pub squads_multisig: UncheckedAccount<'info>,

    /// CHECK: the DAO treasury that receives the remaining USDC and both
    /// authorities.
    #[account(
        seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_VAULT, 0_u8.to_le_bytes().as_ref()],
        bump,
        seeds::program = squads_program,
    )]
    pub squads_multisig_vault: UncheckedAccount<'info>,

    /// CHECK: initialized by squads when a spending limit is configured.
    #[account(
        mut,
        seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_SPENDING_LIMIT, dao.key().as_ref()],
        bump,
        seeds::program = squads_program,
    )]
    pub spending_limit: UncheckedAccount<'info>,

    /// CHECK: checked by squads.
    #[account(
        seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_PROGRAM_CONFIG],
        bump,
        seeds::program = squads_program,
    )]
    pub squads_program_config: UncheckedAccount<'info>,

    /// CHECK: checked by squads.
    #[account(mut)]
    pub squads_program_config_treasury: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = usdc_mint,
        associated_token::authority = squads_multisig_vault,
    )]
    pub treasury_usdc_account: Box<Account<'info, TokenAccount>>,

    pub futarchy_program: Program<'info, Futarchy>,
    /// CHECK: the futarchy program's event-CPI authority PDA.
    #[account(seeds = [b"__event_authority"], bump, seeds::program = futarchy_program)]
    pub futarchy_event_authority: UncheckedAccount<'info>,
    pub squads_program: Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl CompleteRelaunch<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.relaunch.state == RelaunchState::Swapped,
            RelaunchError::RelaunchNotSwapped
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let relaunch_key = ctx.accounts.relaunch.key();

        let seeds = &[
            b"relaunch_signer",
            relaunch_key.as_ref(),
            &[ctx.accounts.relaunch.relaunch_signer_bump],
        ];
        let signer = &[&seeds[..]];

        let usdc_recovered = ctx.accounts.relaunch.usdc_recovered;
        let price_1e12 = (usdc_recovered as u128 * PRICE_SCALE) / (TOKENS_TO_DEPOSITORS as u128);
        let usdc_to_lp = usdc_recovered / 5;

        ctx.accounts.initialize_dao(price_1e12, signer)?;
        ctx.accounts
            .provide_futarchy_amm_liquidity(usdc_to_lp, signer)?;
        let usdc_to_treasury = ctx.accounts.send_remaining_usdc_to_dao(signer)?;
        ctx.accounts.transfer_mint_authority_to_dao(signer)?;
        ctx.accounts.transfer_metadata_authority_to_dao(signer)?;

        let clock = Clock::get()?;
        let relaunch = &mut ctx.accounts.relaunch;
        relaunch.dao = Some(ctx.accounts.dao.key());
        relaunch.dao_vault = Some(ctx.accounts.squads_multisig_vault.key());
        relaunch.state = RelaunchState::Complete;
        relaunch.unix_timestamp_completed = Some(clock.unix_timestamp);
        relaunch.seq_num += 1;

        emit_cpi!(RelaunchCompletedEvent {
            common: CommonFields::new(&clock, relaunch.seq_num),
            relaunch: relaunch_key,
            dao: ctx.accounts.dao.key(),
            dao_vault: ctx.accounts.squads_multisig_vault.key(),
            usdc_recovered,
            twap_initial_observation: price_1e12,
            usdc_to_lp,
            usdc_to_treasury,
        });

        Ok(())
    }

    #[inline(never)]
    fn initialize_dao(&self, price_1e12: u128, signer: &[&[&[u8]]]) -> Result<()> {
        // A zero/empty config means the DAO launches without a Squads
        // spending limit.
        let initial_spending_limit = if self.relaunch.monthly_spending_limit_amount == 0 {
            None
        } else {
            Some(InitialSpendingLimit {
                amount_per_month: self.relaunch.monthly_spending_limit_amount,
                members: self.relaunch.monthly_spending_limit_members.clone(),
            })
        };

        futarchy::cpi::initialize_dao(
            CpiContext::new_with_signer(
                self.futarchy_program.to_account_info(),
                futarchy::cpi::accounts::InitializeDao {
                    dao: self.dao.to_account_info(),
                    dao_creator: self.relaunch_signer.to_account_info(),
                    payer: self.payer.to_account_info(),
                    system_program: self.system_program.to_account_info(),
                    base_mint: self.new_mint.to_account_info(),
                    quote_mint: self.usdc_mint.to_account_info(),
                    event_authority: self.futarchy_event_authority.to_account_info(),
                    program: self.futarchy_program.to_account_info(),
                    squads_multisig: self.squads_multisig.to_account_info(),
                    squads_multisig_vault: self.squads_multisig_vault.to_account_info(),
                    squads_program: self.squads_program.to_account_info(),
                    squads_program_config: self.squads_program_config.to_account_info(),
                    squads_program_config_treasury: self
                        .squads_program_config_treasury
                        .to_account_info(),
                    spending_limit: self.spending_limit.to_account_info(),
                    futarchy_amm_base_vault: self.futarchy_amm_base_vault.to_account_info(),
                    futarchy_amm_quote_vault: self.futarchy_amm_quote_vault.to_account_info(),
                    associated_token_program: self.associated_token_program.to_account_info(),
                    token_program: self.token_program.to_account_info(),
                },
                signer,
            ),
            InitializeDaoParams {
                twap_initial_observation: price_1e12,
                twap_max_observation_change_per_update: price_1e12 / 20,
                twap_start_delay_seconds: 24 * 60 * 60,
                min_quote_futarchic_liquidity: 1,
                min_base_futarchic_liquidity: 1,
                base_to_stake: PROPOSAL_MIN_STAKE_TOKENS,
                pass_threshold_bps: 300,
                seconds_per_proposal: 3 * 24 * 60 * 60,
                nonce: 0,
                initial_spending_limit,
                team_sponsored_pass_threshold_bps: -300,
                team_address: self.relaunch.team_address,
            },
        )
    }

    #[inline(never)]
    fn provide_futarchy_amm_liquidity(&self, usdc_to_lp: u64, signer: &[&[&[u8]]]) -> Result<()> {
        futarchy::cpi::provide_liquidity(
            CpiContext::new_with_signer(
                self.futarchy_program.to_account_info(),
                futarchy::cpi::accounts::ProvideLiquidity {
                    dao: self.dao.to_account_info(),
                    liquidity_provider: self.relaunch_signer.to_account_info(),
                    liquidity_provider_base_account: self.new_token_vault.to_account_info(),
                    liquidity_provider_quote_account: self.usdc_vault.to_account_info(),
                    payer: self.payer.to_account_info(),
                    system_program: self.system_program.to_account_info(),
                    amm_base_vault: self.futarchy_amm_base_vault.to_account_info(),
                    amm_quote_vault: self.futarchy_amm_quote_vault.to_account_info(),
                    amm_position: self.amm_position.to_account_info(),
                    token_program: self.token_program.to_account_info(),
                    program: self.futarchy_program.to_account_info(),
                    event_authority: self.futarchy_event_authority.to_account_info(),
                },
                signer,
            ),
            ProvideLiquidityParams {
                quote_amount: usdc_to_lp,
                max_base_amount: TOKENS_TO_FUTARCHY_LIQUIDITY,
                min_liquidity: 0,
                position_authority: self.squads_multisig_vault.key(),
            },
        )
    }

    /// Sweeps everything left in the USDC vault to the DAO treasury.
    #[inline(never)]
    fn send_remaining_usdc_to_dao(&mut self, signer: &[&[&[u8]]]) -> Result<u64> {
        // Ensure the vault is updated before reading its amount.
        self.usdc_vault.reload()?;
        let usdc_to_treasury = self.usdc_vault.amount;

        token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.usdc_vault.to_account_info(),
                    to: self.treasury_usdc_account.to_account_info(),
                    authority: self.relaunch_signer.to_account_info(),
                },
                signer,
            ),
            usdc_to_treasury,
        )?;

        Ok(usdc_to_treasury)
    }

    #[inline(never)]
    fn transfer_mint_authority_to_dao(&self, signer: &[&[&[u8]]]) -> Result<()> {
        token::set_authority(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                SetAuthority {
                    account_or_mint: self.new_mint.to_account_info(),
                    current_authority: self.relaunch_signer.to_account_info(),
                },
                signer,
            ),
            AuthorityType::MintTokens,
            Some(self.squads_multisig_vault.key()),
        )
    }

    #[inline(never)]
    fn transfer_metadata_authority_to_dao(&self, signer: &[&[&[u8]]]) -> Result<()> {
        update_metadata_accounts_v2(
            CpiContext::new_with_signer(
                self.token_metadata_program.to_account_info(),
                UpdateMetadataAccountsV2 {
                    metadata: self.token_metadata.to_account_info(),
                    update_authority: self.relaunch_signer.to_account_info(),
                },
                signer,
            ),
            Some(self.squads_multisig_vault.key()),
            None,
            None,
            None,
        )
    }
}
