use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeLargeSpendProposalArgs {
    pub amount: u64,
}

#[derive(Accounts)]
#[event_cpi]
pub struct InitializeLargeSpendProposal<'info> {
    pub create: TypedCreateAccounts<'info>,
}

impl InitializeLargeSpendProposal<'_> {
    pub fn validate(&self, args: &InitializeLargeSpendProposalArgs) -> Result<()> {
        self.create.validate()?;

        let record = self
            .create
            .dao
            .initial_spending_limit
            .as_ref()
            .ok_or(FutarchyError::NoSpendingLimit)?;

        require_gte!(
            record.amount_per_month.saturating_mul(3),
            args.amount,
            FutarchyError::SpendCapExceeded
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: InitializeLargeSpendProposalArgs) -> Result<()> {
        let create = &mut ctx.accounts.create;
        let dao = &create.dao;

        // The recipient is pinned to the DAO's team address at create; a later
        // team change does not re-point it.
        let transfer_ix = token::spl_token::instruction::transfer(
            &token::ID,
            &anchor_spl::associated_token::get_associated_token_address(
                &dao.squads_multisig_vault,
                &dao.quote_mint,
            ),
            &anchor_spl::associated_token::get_associated_token_address(
                &dao.team_address,
                &dao.quote_mint,
            ),
            &dao.squads_multisig_vault,
            &[],
            args.amount,
        )?;

        let event = create.create_proposal(
            &[transfer_ix],
            ProposalAction::LargeSpend {
                amount: args.amount,
            },
            ctx.bumps.create.proposal,
        )?;

        emit_cpi!(event);

        Ok(())
    }
}
