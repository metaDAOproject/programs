use squads_multisig_program::{Member, Permission, Permissions};

use super::*;

#[derive(Debug, Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct InitializeDaoParams {
    pub twap_initial_observation: u128,
    pub twap_max_observation_change_per_update: u128,
    pub twap_start_delay_slots: u64,
    pub min_quote_futarchic_liquidity: u64,
    pub min_base_futarchic_liquidity: u64,
    pub pass_threshold_bps: u16,
    pub slots_per_proposal: u64,
    pub nonce: u64,
}

#[derive(Accounts)]
#[event_cpi]
#[instruction(params: InitializeDaoParams)]
pub struct InitializeDao<'info> {
    #[account(
        init,
        payer = payer,
        seeds = [b"dao", params.nonce.to_le_bytes().as_ref()],
        bump,
        space = 8 + Dao::INIT_SPACE,
    )]
    pub dao: Account<'info, Dao>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub base_mint: Account<'info, Mint>,
    // todo: statically check that this is USDC given a feature flag
    #[account(mint::decimals = 6)]
    pub quote_mint: Account<'info, Mint>,
    /// CHECK: initialized by squads
    #[account(mut, seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_MULTISIG, dao.key().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig: UncheckedAccount<'info>,
    /// CHECK: just a signer
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_VAULT, 0_u8.to_le_bytes().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig_vault: UncheckedAccount<'info>,
    pub squads_program: Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_PROGRAM_CONFIG], bump, seeds::program = squads_program)]
    pub squads_program_config: Account<'info, squads_multisig_program::state::ProgramConfig>,
    /// CHECK: checked by squads multisig program
    #[account(mut)]
    pub squads_program_config_treasury: UncheckedAccount<'info>,
}

pub mod permissionless_account {
    use anchor_lang::prelude::declare_id;

    declare_id!("EP3SoC2SvR3d4c2eXVBvhEMWSr2j3YtoCY3UMiQV7BPD");
}

impl InitializeDao<'_> {
    pub fn handle(ctx: Context<Self>, params: InitializeDaoParams) -> Result<()> {
        let InitializeDaoParams {
            twap_initial_observation,
            twap_max_observation_change_per_update,
            twap_start_delay_slots,
            min_base_futarchic_liquidity,
            min_quote_futarchic_liquidity,
            pass_threshold_bps,
            slots_per_proposal,
            nonce,
        } = params;

        let dao = &mut ctx.accounts.dao;

        require!(
            slots_per_proposal > twap_start_delay_slots,
            AutocratError::ProposalDurationTooShort
        );

        let dao_seeds = &[b"dao".as_ref(), &nonce.to_le_bytes(), &[ctx.bumps.dao]];

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

        dao.set_inner(Dao {
            nonce,
            pda_bump: ctx.bumps.dao,
            squads_multisig: ctx.accounts.squads_multisig.key(),
            squads_multisig_vault: ctx.accounts.squads_multisig_vault.key(),
            base_mint: ctx.accounts.base_mint.key(),
            quote_mint: ctx.accounts.quote_mint.key(),
            proposal_count: 0,
            pass_threshold_bps,
            slots_per_proposal,
            twap_initial_observation,
            twap_max_observation_change_per_update,
            twap_start_delay_slots,
            min_base_futarchic_liquidity,
            min_quote_futarchic_liquidity,
            seq_num: 0,
        });

        let clock = Clock::get()?;
        emit_cpi!(InitializeDaoEvent {
            common: CommonFields::new(&clock),
            dao: dao.key(),
            base_mint: ctx.accounts.base_mint.key(),
            quote_mint: ctx.accounts.quote_mint.key(),
            pass_threshold_bps: dao.pass_threshold_bps,
            slots_per_proposal: dao.slots_per_proposal,
            twap_initial_observation: dao.twap_initial_observation,
            twap_max_observation_change_per_update: dao.twap_max_observation_change_per_update,
            min_quote_futarchic_liquidity: dao.min_quote_futarchic_liquidity,
            min_base_futarchic_liquidity: dao.min_base_futarchic_liquidity,
        });

        Ok(())
    }
}
