// use anchor_lang::solana_program::system_program;
use anchor_lang::{system_program, Discriminator};

use super::*;

#[derive(Accounts)]
pub struct ResizeDao<'info> {
    /// CHECK: we check the discriminator
    #[account(mut)]
    pub dao: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl ResizeDao<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let dao = &mut ctx.accounts.dao;

        require_eq!(dao.owner, &ID);
        let is_discriminator_correct =
            dao.data.try_borrow_mut().unwrap()[..8] == Dao::discriminator();
        require_eq!(is_discriminator_correct, true);

        const AFTER_REALLOC_SIZE: usize = Dao::INIT_SPACE + 8;
        const BEFORE_REALLOC_SIZE: usize = AFTER_REALLOC_SIZE - (2 + 32); // 2 for `team_sponsored_pass_threshold_bps` and 32 for `team_address`

        // require_eq!(question.data_len(), V0_SIZE);
        if dao.data_len() != BEFORE_REALLOC_SIZE {
            // already realloced
            require_eq!(dao.data_len(), AFTER_REALLOC_SIZE);
            return Ok(());
        }

        let old_dao_data = OldDao::deserialize(&mut &dao.try_borrow_data().unwrap()[8..])?;

        let new_dao_data = Dao {
            amm: old_dao_data.amm,
            nonce: old_dao_data.nonce,
            dao_creator: old_dao_data.dao_creator,
            pda_bump: old_dao_data.pda_bump,
            squads_multisig: old_dao_data.squads_multisig,
            squads_multisig_vault: old_dao_data.squads_multisig_vault,
            base_mint: old_dao_data.base_mint,
            quote_mint: old_dao_data.quote_mint,
            proposal_count: old_dao_data.proposal_count,
            pass_threshold_bps: old_dao_data.pass_threshold_bps,
            seconds_per_proposal: old_dao_data.seconds_per_proposal,
            twap_initial_observation: old_dao_data.twap_initial_observation,
            twap_max_observation_change_per_update: old_dao_data
                .twap_max_observation_change_per_update,
            twap_start_delay_seconds: old_dao_data.twap_start_delay_seconds,
            min_quote_futarchic_liquidity: old_dao_data.min_quote_futarchic_liquidity,
            min_base_futarchic_liquidity: old_dao_data.min_base_futarchic_liquidity,
            base_to_stake: old_dao_data.base_to_stake,
            seq_num: old_dao_data.seq_num,
            initial_spending_limit: old_dao_data.initial_spending_limit,
            team_sponsored_pass_threshold_bps: 0,
            team_address: Pubkey::default(),
        };
        dao.realloc(AFTER_REALLOC_SIZE, true)?;

        let lamports_needed = Rent::get()?.minimum_balance(AFTER_REALLOC_SIZE);

        if lamports_needed > dao.lamports() {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: dao.to_account_info(),
                    },
                ),
                lamports_needed - dao.lamports(),
            )?;
        }

        new_dao_data.serialize(&mut &mut dao.try_borrow_mut_data().unwrap()[8..])?;

        Ok(())
    }
}
