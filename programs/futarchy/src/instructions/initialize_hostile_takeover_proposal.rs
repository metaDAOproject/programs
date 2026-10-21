use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeHostileTakeoverProposalArgs {
    pub new_team_address: Pubkey,
    pub spending_limit_action: SpendingLimitAction,
}

#[derive(Accounts)]
#[event_cpi]
pub struct InitializeHostileTakeoverProposal<'info> {
    pub typed_initialize_accounts: TypedInitializeAccounts<'info>,
}

impl InitializeHostileTakeoverProposal<'_> {
    pub fn validate(&self, args: &InitializeHostileTakeoverProposalArgs) -> Result<()> {
        // Hostile takeovers are switched off in production for now.
        if cfg!(feature = "production") {
            return err!(FutarchyError::InvalidProposalKind);
        }

        self.typed_initialize_accounts.validate()?;

        require_keys_neq!(
            args.new_team_address,
            self.typed_initialize_accounts.dao.team_address,
            FutarchyError::InvalidTeamAddress
        );

        if let SpendingLimitAction::Set(config) = &args.spending_limit_action {
            config.validate()?;
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: InitializeHostileTakeoverProposalArgs) -> Result<()> {
        let typed_initialize_accounts = &mut ctx.accounts.typed_initialize_accounts;

        // The payload is only a memo: finalize_proposal applies a passed takeover itself.
        let spending_limit = match &args.spending_limit_action {
            SpendingLimitAction::Keep => "keep".to_string(),
            SpendingLimitAction::Remove => "remove".to_string(),
            SpendingLimitAction::Set(limit) => format!("set:{}", limit.amount_per_month),
        };
        let memo = format!(
            "metadao-takeover/1 proposal={} new_team={} spending_limit={}",
            typed_initialize_accounts.proposal.key(),
            args.new_team_address,
            spending_limit,
        );
        let memo_ix = spl_memo::build_memo(memo.as_bytes(), &[]);

        let event = typed_initialize_accounts.initialize_proposal(
            &[memo_ix],
            ProposalAction::HostileTakeover {
                new_team_address: args.new_team_address,
                spending_limit_action: args.spending_limit_action,
            },
            ctx.bumps.typed_initialize_accounts.proposal,
        )?;

        emit_cpi!(event);

        Ok(())
    }
}
