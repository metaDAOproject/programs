use anchor_lang::{system_program, Discriminator};

use super::*;

#[derive(Accounts)]
pub struct ResizeDao<'info> {
    /// CHECK: we check the discriminator
    #[account(mut)]
    pub dao: UncheckedAccount<'info>,
    /// The DAO's base mint, bound to `old.base_mint` below. Because this crank is
    /// permissionless, the mint must be bound so a caller can't pass a fabricated
    /// low-decimal mint to set a near-zero supermajority bar.
    pub base_mint: Account<'info, Mint>,
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

        const AFTER_REALLOC_SIZE: usize = Dao::INIT_SPACE + 8;
        // 8 bytes: base_to_supermajority (u64)
        const BEFORE_REALLOC_SIZE: usize = AFTER_REALLOC_SIZE - 8;

        if dao.data_len() != BEFORE_REALLOC_SIZE {
            // already realloced
            require_eq!(dao.data_len(), AFTER_REALLOC_SIZE);
            return Ok(());
        }

        let old_dao_data = OldDao::deserialize(&mut &dao.try_borrow_data().unwrap()[8..])?;

        // Bind the passed mint to the DAO before trusting its decimals.
        require_keys_eq!(
            ctx.accounts.base_mint.key(),
            old_dao_data.base_mint,
            FutarchyError::InvalidMint
        );

        // 2.5M WHOLE tokens scaled to base units by the base mint's on-chain decimals
        let scaled = DEFAULT_BASE_TO_SUPERMAJORITY_TOKENS
            .checked_mul(
                10u64
                    .checked_pow(ctx.accounts.base_mint.decimals as u32)
                    .ok_or(FutarchyError::CastingOverflow)?,
            )
            .ok_or(FutarchyError::CastingOverflow)?;
        // Never below the DAO's own base_to_stake floor, so the supermajority bar can't become the *easier* path.
        let base_to_supermajority = scaled.max(old_dao_data.base_to_stake);

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
            team_sponsored_pass_threshold_bps: old_dao_data.team_sponsored_pass_threshold_bps,
            team_address: old_dao_data.team_address,
            optimistic_proposal: old_dao_data.optimistic_proposal,
            is_optimistic_governance_enabled: old_dao_data.is_optimistic_governance_enabled,
            base_to_supermajority,
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
