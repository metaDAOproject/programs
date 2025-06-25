use super::*;

use squads_multisig_program::{Member, Multisig, Permission, Permissions};

#[derive(Debug, Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct InitializeDaoParams {
    pub twap_initial_observation: u128,
    pub twap_max_observation_change_per_update: u128,
    pub twap_start_delay_slots: u64,
    pub min_quote_futarchic_liquidity: u64,
    pub min_base_futarchic_liquidity: u64,
    pub pass_threshold_bps: Option<u16>,
    pub slots_per_proposal: Option<u64>,
    pub nonce: u64,
}

#[derive(Accounts)]
#[event_cpi]
#[instruction(args: InitializeDaoParams)]
pub struct InitializeDao<'info> {
    #[account(
        init,
        seeds = [b"dao", args.nonce.to_le_bytes().as_ref()],
        bump,
        payer = payer,
        space = 8 + Dao::INIT_SPACE,
    )]
    pub dao: Account<'info, Dao>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_mint: Account<'info, Mint>,
    // todo: statically check that this is USDC given a feature flag
    #[account(mint::decimals = 6)]
    pub usdc_mint: Account<'info, Mint>,
    /// CHECK: fix this later
    #[account(mut)]
    pub multisig: UncheckedAccount<'info>,
    pub squads_multisig_program: Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_PROGRAM_CONFIG], bump, seeds::program = squads_multisig_program)]
    pub squads_program_config: Account<'info, squads_multisig_program::state::ProgramConfig>,
    /// CHECK: checked by squads multisig program
    #[account(mut)]
    pub squads_program_config_treasury: UncheckedAccount<'info>,
}

pub mod permissionless_account {
    use anchor_lang::prelude::declare_id;

    declare_id!("613BRiXuAEn7vibs2oAYzpGW9fXgjzDNuFMM4wPzLdY");
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
        let dao_key = dao.key();

        let dao_seeds = &[b"dao".as_ref(), &nonce.to_le_bytes(), &[ctx.bumps.dao]];
        let dao_signer = &[&dao_seeds[..]];

        let (treasury, treasury_pda_bump) =
            Pubkey::find_program_address(&[dao_key.as_ref()], ctx.program_id);

        let slots_per_proposal = slots_per_proposal.unwrap_or(THREE_DAYS_IN_SLOTS);

        require!(
            slots_per_proposal > twap_start_delay_slots,
            AutocratError::ProposalDurationTooShort
        );

        squads_multisig_program::cpi::multisig_create_v2(
            CpiContext::new_with_signer(
                ctx.accounts.squads_multisig_program.to_account_info(),
                squads_multisig_program::cpi::accounts::MultisigCreateV2 {
                    program_config: ctx.accounts.squads_program_config.to_account_info(),
                    multisig: ctx.accounts.multisig.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    treasury: ctx.accounts.squads_program_config_treasury.to_account_info(),
                    create_key: dao.to_account_info(),
                    creator: ctx.accounts.payer.to_account_info(),
                },
                dao_signer,
            ), 
            squads_multisig_program::MultisigCreateArgsV2 {
                config_authority: Some(dao_key),
                threshold: 1,
                members: vec![
                    Member {
                        key: dao_key,
                        permissions: Permissions::from_vec(&[Permission::Vote]),
                    },
                    Member {
                        key: permissionless_account::id(),
                        permissions: Permissions::from_vec(&[Permission::Initiate, Permission::Execute]),
                    }
                ],
                time_lock: 0,
                rent_collector: None,
                memo: None,
            }
        )?;
            
        dao.set_inner(Dao {
            token_mint: ctx.accounts.token_mint.key(),
            usdc_mint: ctx.accounts.usdc_mint.key(),
            treasury_pda_bump,
            treasury,
            proposal_count: 0,
            pass_threshold_bps: pass_threshold_bps.unwrap_or(DEFAULT_PASS_THRESHOLD_BPS),
            slots_per_proposal,
            twap_initial_observation,
            twap_max_observation_change_per_update,
            twap_start_delay_slots,
            min_base_futarchic_liquidity,
            min_quote_futarchic_liquidity,
            seq_num: 0,
            squads_multisig: ctx.accounts.multisig.key(),
            nonce,
            pda_bump: ctx.bumps.dao,
        });

        let clock = Clock::get()?;
        emit_cpi!(InitializeDaoEvent {
            common: CommonFields::new(&clock),
            dao: dao.key(),
            token_mint: ctx.accounts.token_mint.key(),
            usdc_mint: ctx.accounts.usdc_mint.key(),
            treasury,
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
