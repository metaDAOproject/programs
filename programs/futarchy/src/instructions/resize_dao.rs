use anchor_lang::{system_program, Discriminator};
use squads_multisig_program::{Period, SpendingLimit};

use super::*;

#[derive(Accounts)]
pub struct ResizeDao<'info> {
    /// CHECK: we check the discriminator
    #[account(mut)]
    pub dao: UncheckedAccount<'info>,
    /// CHECK: verified in the handler against the canonical Squads
    /// spending-limit PDA (`create_key` is always the DAO); read-only and may
    /// not exist
    pub spending_limit: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl ResizeDao<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let dao = &ctx.accounts.dao;

        require_eq!(dao.owner, &crate::ID);
        let is_discriminator_correct = dao.try_borrow_data().unwrap()[..8] == Dao::discriminator();
        require_eq!(is_discriminator_correct, true);

        const AFTER_REALLOC_SIZE: usize = Dao::MIGRATED_SIZE;
        // 58 bytes: 33 (Option<Pubkey> liquidator) + 8 (i64) + 8 (i64) + 1 (bool) + 8 (i64)
        const BEFORE_REALLOC_SIZE: usize = AFTER_REALLOC_SIZE - 58;

        if dao.data_len() != BEFORE_REALLOC_SIZE {
            // already realloced
            require_eq!(dao.data_len(), AFTER_REALLOC_SIZE);
            return Ok(());
        }

        let old_dao_data = OldDao::deserialize(&mut &dao.try_borrow_data().unwrap()[8..])?;

        let (canonical_spending_limit, _) = Pubkey::find_program_address(
            &[
                squads_multisig_program::SEED_PREFIX,
                old_dao_data.squads_multisig.as_ref(),
                squads_multisig_program::SEED_SPENDING_LIMIT,
                dao.key().as_ref(),
            ],
            &squads_multisig_program::ID,
        );
        require_keys_eq!(
            ctx.accounts.spending_limit.key(),
            canonical_spending_limit,
            FutarchyError::InvalidSpendingLimitAccount
        );

        // The record must reflect the live Squads account because of the 
        // LargeSpend authorization cap.
        let live_spending_limit = Self::live_canonical_spending_limit(
            &ctx.accounts.spending_limit,
            &old_dao_data.quote_mint,
        );

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
            initial_spending_limit: live_spending_limit,
            team_sponsored_pass_threshold_bps: old_dao_data.team_sponsored_pass_threshold_bps,
            team_address: old_dao_data.team_address,
            // The optimistic execution machinery is gone; any in-flight
            // optimistic spend is cleared rather than carried over.
            optimistic_proposal: None,
            is_optimistic_governance_enabled: old_dao_data.is_optimistic_governance_enabled,
            liquidator: None,
            last_failed_takeover_at: 0,
            last_failed_liquidation_at: 0,
            spending_limit_dirty: false,
            last_buyback_finalized_at: 0,
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

    /// Reads the live canonical Squads spending limit into a record, or `None`
    /// if the account doesn't exist or holds any shape `initialize_dao` could
    /// not have created.
    fn live_canonical_spending_limit(
        spending_limit: &UncheckedAccount,
        quote_mint: &Pubkey,
    ) -> Option<InitialSpendingLimit> {
        if spending_limit.owner != &squads_multisig_program::ID {
            return None;
        }

        let data = spending_limit.try_borrow_data().ok()?;
        let live = SpendingLimit::try_deserialize(&mut &**data).ok()?;

        let is_canonical_shape = live.vault_index == 0
            && live.mint == *quote_mint
            && matches!(live.period, Period::Month)
            && live.members.len() <= MAX_SPENDING_LIMIT_MEMBERS
            && live.destinations.is_empty();

        is_canonical_shape.then(|| InitialSpendingLimit {
            amount_per_month: live.amount,
            members: live.members.clone(),
        })
    }
}
