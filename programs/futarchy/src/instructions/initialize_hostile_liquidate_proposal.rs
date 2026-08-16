use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeHostileLiquidateProposalArgs {
    pub liquidator: Pubkey,
}

#[derive(Accounts)]
#[event_cpi]
pub struct InitializeHostileLiquidateProposal<'info> {
    pub typed_initialize_accounts: TypedInitializeAccounts<'info>,
}

impl InitializeHostileLiquidateProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        self.typed_initialize_accounts.validate()
    }

    pub fn handle(ctx: Context<Self>, args: InitializeHostileLiquidateProposalArgs) -> Result<()> {
        let typed_initialize_accounts = &mut ctx.accounts.typed_initialize_accounts;

        // The IP transfer is a legal-layer fact.
        // The memo records it in the executed transaction.
        let memo_ix = spl_memo::build_memo(
            b"Intellectual property transferred to the DAO upon initialization will be transferred back to the original team.",
            &[],
        );

        // The on-chain actions of liquidation are handled by the liquidator.

        let event = typed_initialize_accounts.initialize_proposal(
            &[memo_ix],
            ProposalAction::HostileLiquidate {
                liquidator: args.liquidator,
            },
            ctx.bumps.typed_initialize_accounts.proposal,
        )?;

        emit_cpi!(event);

        Ok(())
    }
}
