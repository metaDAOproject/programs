use super::*;

use squads_multisig_program::{
    program::SquadsMultisigProgram, Member, Period, Permission, Permissions,
};

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct InitializeDaoParams {
    pub twap_initial_observation: u128,
    pub twap_max_observation_change_per_update: u128,
    pub twap_start_delay_seconds: u32,
    pub min_quote_futarchic_liquidity: u64,
    pub min_base_futarchic_liquidity: u64,
    pub base_to_stake: u64,
    pub pass_threshold_bps: u16,
    pub seconds_per_proposal: u32,
    pub nonce: u64,
    pub initial_spending_limit: Option<InitialSpendingLimit>,
}

#[derive(Accounts)]
#[event_cpi]
#[instruction(params: InitializeDaoParams)]
pub struct InitializeDao<'info> {
    #[account(
        init,
        payer = payer,
        seeds = [b"dao", dao_creator.key().as_ref(), params.nonce.to_le_bytes().as_ref()],
        bump,
        space = 8 + Dao::INIT_SPACE,
    )]
    pub dao: Box<Account<'info, Dao>>,
    pub dao_creator: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub base_mint: Box<Account<'info, Mint>>,
    #[account(mint::decimals = 6)]
    pub quote_mint: Box<Account<'info, Mint>>,
    /// CHECK: initialized by squads
    #[account(mut, seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_MULTISIG, dao.key().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig: UncheckedAccount<'info>,
    /// CHECK: just a signer
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_VAULT, 0_u8.to_le_bytes().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig_vault: UncheckedAccount<'info>,
    pub squads_program: Program<'info, SquadsMultisigProgram>,
    /// CHECK: checked by squads
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_PROGRAM_CONFIG], bump, seeds::program = squads_program)]
    pub squads_program_config: UncheckedAccount<'info>,
    /// CHECK: checked by squads multisig program
    #[account(mut)]
    pub squads_program_config_treasury: UncheckedAccount<'info>,
    /// CHECK: initialized by squads
    #[account(mut, seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_SPENDING_LIMIT, dao.key().as_ref()], bump, seeds::program = squads_program)]
    pub spending_limit: UncheckedAccount<'info>,
    #[account(init_if_needed, associated_token::mint = base_mint, associated_token::authority = dao, payer = payer)]
    pub futarchy_amm_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(init_if_needed, associated_token::mint = quote_mint, associated_token::authority = dao, payer = payer)]
    pub futarchy_amm_quote_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub mod permissionless_account {
    use anchor_lang::prelude::declare_id;

    declare_id!("EP3SoC2SvR3d4c2eXVBvhEMWSr2j3YtoCY3UMiQV7BPD");
}

impl InitializeDao<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: InitializeDaoParams) -> Result<()> {
        let InitializeDaoParams {
            twap_initial_observation,
            twap_max_observation_change_per_update,
            twap_start_delay_seconds,
            min_base_futarchic_liquidity,
            min_quote_futarchic_liquidity,
            base_to_stake,
            pass_threshold_bps,
            seconds_per_proposal,
            nonce,
            initial_spending_limit,
        } = params;

        let dao = &mut ctx.accounts.dao;

        require!(
            seconds_per_proposal > twap_start_delay_seconds,
            AutocratError::ProposalDurationTooShort
        );

        let creator_key = ctx.accounts.dao_creator.key();
        let dao_seeds = &[
            b"dao".as_ref(),
            creator_key.as_ref(),
            &nonce.to_le_bytes(),
            &[ctx.bumps.dao],
        ];

        squads_multisig_program::cpi::multisig_create_v2(
            CpiContext::new_with_signer(
                ctx.accounts.squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::MultisigCreateV2 {
                    program_config: ctx.accounts.squads_program_config.to_account_info(),
                    multisig: ctx.accounts.squads_multisig.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    treasury: ctx
                        .accounts
                        .squads_program_config_treasury
                        .to_account_info(),
                    create_key: dao.to_account_info(),
                    creator: ctx.accounts.payer.to_account_info(),
                },
                &[&dao_seeds[..]],
            ),
            squads_multisig_program::MultisigCreateArgsV2 {
                config_authority: Some(dao.key()),
                threshold: 1,
                members: vec![
                    Member {
                        key: dao.key(),
                        permissions: Permissions::from_vec(&[Permission::Vote]),
                    },
                    Member {
                        key: permissionless_account::id(),
                        permissions: Permissions::from_vec(&[
                            Permission::Initiate,
                            Permission::Execute,
                        ]),
                    },
                ],
                time_lock: 0,
                rent_collector: None,
                memo: None,
            },
        )?;

        if let Some(initial_spending_limit) = initial_spending_limit.clone() {
            squads_multisig_program::cpi::multisig_add_spending_limit(
                CpiContext::new_with_signer(
                    ctx.accounts.squads_program.to_account_info(),
                    squads_multisig_program::cpi::accounts::MultisigAddSpendingLimit {
                        multisig: ctx.accounts.squads_multisig.to_account_info(),
                        system_program: ctx.accounts.system_program.to_account_info(),
                        rent_payer: ctx.accounts.payer.to_account_info(),
                        config_authority: dao.to_account_info(),
                        spending_limit: ctx.accounts.spending_limit.to_account_info(),
                    },
                    &[&dao_seeds[..]],
                ),
                squads_multisig_program::MultisigAddSpendingLimitArgs {
                    create_key: dao.key(),
                    vault_index: 0,
                    mint: ctx.accounts.quote_mint.key(),
                    amount: initial_spending_limit.amount_per_month,
                    period: Period::Month,
                    members: initial_spending_limit.members,
                    destinations: vec![],
                    memo: None,
                },
            )?;
        }

        let clock = Clock::get()?;

        dao.set_inner(Dao {
            nonce,
            dao_creator: creator_key,
            pda_bump: ctx.bumps.dao,
            squads_multisig: ctx.accounts.squads_multisig.key(),
            squads_multisig_vault: ctx.accounts.squads_multisig_vault.key(),
            base_mint: ctx.accounts.base_mint.key(),
            quote_mint: ctx.accounts.quote_mint.key(),
            proposal_count: 0,
            pass_threshold_bps,
            seconds_per_proposal,
            twap_initial_observation,
            twap_max_observation_change_per_update,
            twap_start_delay_seconds,
            min_base_futarchic_liquidity,
            min_quote_futarchic_liquidity,
            base_to_stake,
            seq_num: 0,
            initial_spending_limit,
            amm: FutarchyAmm {
                state: PoolState::Spot {
                    spot: Pool {
                        quote_reserves: 0,
                        base_reserves: 0,
                        quote_protocol_fee_balance: 0,
                        base_protocol_fee_balance: 0,
                        oracle: TwapOracle::new(
                            clock.unix_timestamp,
                            twap_initial_observation,
                            twap_max_observation_change_per_update,
                            0,
                        ),
                    },
                },
                total_liquidity: 0,
                base_mint: ctx.accounts.base_mint.key(),
                quote_mint: ctx.accounts.quote_mint.key(),
                amm_base_vault: ctx.accounts.futarchy_amm_base_vault.key(),
                amm_quote_vault: ctx.accounts.futarchy_amm_quote_vault.key(),
            },
        });

        let clock = Clock::get()?;
        emit_cpi!(InitializeDaoEvent {
            common: CommonFields::new(&clock),
            dao: dao.key(),
            base_mint: ctx.accounts.base_mint.key(),
            quote_mint: ctx.accounts.quote_mint.key(),
            pass_threshold_bps: dao.pass_threshold_bps,
            seconds_per_proposal: dao.seconds_per_proposal,
            twap_initial_observation: dao.twap_initial_observation,
            twap_max_observation_change_per_update: dao.twap_max_observation_change_per_update,
            min_quote_futarchic_liquidity: dao.min_quote_futarchic_liquidity,
            min_base_futarchic_liquidity: dao.min_base_futarchic_liquidity,
            base_to_stake: dao.base_to_stake,
            initial_spending_limit: dao.initial_spending_limit.clone(),
            squads_multisig: dao.squads_multisig,
            squads_multisig_vault: dao.squads_multisig_vault,
        });

        Ok(())
    }
}
