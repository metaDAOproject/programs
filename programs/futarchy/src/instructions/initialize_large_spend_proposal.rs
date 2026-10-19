use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeLargeSpendProposalArgs {
    pub amount: u64,
}

#[derive(Accounts)]
#[event_cpi]
pub struct InitializeLargeSpendProposal<'info> {
    pub typed_initialize_accounts: TypedInitializeAccounts<'info>,
}

impl InitializeLargeSpendProposal<'_> {
    pub fn validate(&self, args: &InitializeLargeSpendProposalArgs) -> Result<()> {
        self.typed_initialize_accounts.validate()?;

        let record = self
            .typed_initialize_accounts
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
        let typed_initialize_accounts = &mut ctx.accounts.typed_initialize_accounts;
        let dao = &typed_initialize_accounts.dao;

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

        let event = typed_initialize_accounts.initialize_proposal(
            &[transfer_ix],
            ProposalAction::LargeSpend {
                amount: args.amount,
            },
            ctx.bumps.typed_initialize_accounts.proposal,
        )?;

        emit_cpi!(event);

        Ok(())
    }
}
