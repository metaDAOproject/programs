use super::*;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct SetSpendingLimitArgs {
    /// `Some` becomes the new record verbatim; `None` deletes it.
    pub config: Option<InitialSpendingLimit>,
}

#[derive(Accounts)]
#[event_cpi]
pub struct SetSpendingLimit<'info> {
    #[account(mut, has_one = squads_multisig_vault)]
    pub dao: Box<Account<'info, Dao>>,
    pub squads_multisig_vault: Signer<'info>,
}

impl SetSpendingLimit<'_> {
    pub fn validate(&self, args: &SetSpendingLimitArgs) -> Result<()> {
        // Prevent config changes during active futarchy markets
        if !matches!(self.dao.amm.state, PoolState::Spot { .. }) {
            return Err(FutarchyError::PoolNotInSpotState.into());
        }

        require!(self.dao.liquidator.is_none(), FutarchyError::DaoLiquidated);

        if let Some(config) = &args.config {
            require_gte!(
                MAX_SPENDING_LIMIT_MEMBERS,
                config.members.len(),
                FutarchyError::TooManySpendingLimitMembers
            );
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: SetSpendingLimitArgs) -> Result<()> {
        let dao = &mut ctx.accounts.dao;

        dao.initial_spending_limit = args.config;
        dao.spending_limit_dirty = true;
        dao.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(SetSpendingLimitEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            dao: dao.key(),
            config: dao.initial_spending_limit.clone(),
        });

        Ok(())
    }
}
