use super::*;

use squads_multisig_program::{program::SquadsMultisigProgram, Period};

#[derive(Accounts)]
#[event_cpi]
pub struct SyncSpendingLimit<'info> {
    #[account(mut, has_one = squads_multisig)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(mut)]
    pub squads_multisig: Box<Account<'info, squads_multisig_program::Multisig>>,
    /// CHECK: the Squads spending-limit PDA (`create_key` is always the DAO); may not exist
    #[account(mut, seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_SPENDING_LIMIT, dao.key().as_ref()], bump, seeds::program = squads_program)]
    pub spending_limit: UncheckedAccount<'info>,
    /// Pays rent when the limit is recreated and receives freed rent when it is removed.
    #[account(mut)]
    pub rent_payer: Signer<'info>,
    pub squads_program: Program<'info, SquadsMultisigProgram>,
    pub system_program: Program<'info, System>,
}

impl SyncSpendingLimit<'_> {
    pub fn validate(&self) -> Result<()> {
        // Remove-recreate resets the period's spent amount, so an ungated sync
        // would let a team refresh its own monthly budget at will.
        require!(
            self.dao.spending_limit_dirty,
            FutarchyError::SpendingLimitNotDirty
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let dao = &ctx.accounts.dao;

        let dao_nonce = &dao.nonce.to_le_bytes();
        let dao_creator_key = &dao.dao_creator.as_ref();
        let dao_seeds = &[SEED_DAO, dao_creator_key, dao_nonce, &[dao.pda_bump]];
        let dao_signer = &[&dao_seeds[..]];

        if !ctx.accounts.spending_limit.data_is_empty() {
            squads_multisig_program::cpi::multisig_remove_spending_limit(
                CpiContext::new_with_signer(
                    ctx.accounts.squads_program.to_account_info(),
                    squads_multisig_program::cpi::accounts::MultisigRemoveSpendingLimit {
                        multisig: ctx.accounts.squads_multisig.to_account_info(),
                        config_authority: dao.to_account_info(),
                        spending_limit: ctx.accounts.spending_limit.to_account_info(),
                        rent_collector: ctx.accounts.rent_payer.to_account_info(),
                    },
                    dao_signer,
                ),
                squads_multisig_program::MultisigRemoveSpendingLimitArgs { memo: None },
            )?;
        }

        // Liquidation zeroes the record, but guard anyway so a liquidated DAO
        // always projects "no limit"
        let projected_config = if dao.liquidator.is_none() {
            dao.initial_spending_limit.clone()
        } else {
            None
        };

        if let Some(config) = &projected_config {
            squads_multisig_program::cpi::multisig_add_spending_limit(
                CpiContext::new_with_signer(
                    ctx.accounts.squads_program.to_account_info(),
                    squads_multisig_program::cpi::accounts::MultisigAddSpendingLimit {
                        multisig: ctx.accounts.squads_multisig.to_account_info(),
                        system_program: ctx.accounts.system_program.to_account_info(),
                        rent_payer: ctx.accounts.rent_payer.to_account_info(),
                        config_authority: dao.to_account_info(),
                        spending_limit: ctx.accounts.spending_limit.to_account_info(),
                    },
                    dao_signer,
                ),
                squads_multisig_program::MultisigAddSpendingLimitArgs {
                    create_key: dao.key(),
                    vault_index: 0,
                    mint: dao.quote_mint,
                    amount: config.amount_per_month,
                    period: Period::Month,
                    members: config.members.clone(),
                    destinations: vec![],
                    memo: None,
                },
            )?;
        }

        let dao = &mut ctx.accounts.dao;
        dao.spending_limit_dirty = false;
        dao.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(SyncSpendingLimitEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            dao: dao.key(),
            spending_limit: ctx.accounts.spending_limit.key(),
            config: projected_config,
        });

        Ok(())
    }
}
