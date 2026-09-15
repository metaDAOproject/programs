use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::InstructionData;

use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeSpendingLimitChangeProposalArgs {
    /// `Some` replaces the record, `None` removes it.
    pub config: Option<InitialSpendingLimit>,
}

#[derive(Accounts)]
#[event_cpi]
pub struct InitializeSpendingLimitChangeProposal<'info> {
    pub typed_initialize_accounts: TypedInitializeAccounts<'info>,
}

impl InitializeSpendingLimitChangeProposal<'_> {
    pub fn validate(&self, args: &InitializeSpendingLimitChangeProposalArgs) -> Result<()> {
        self.typed_initialize_accounts.validate()?;

        if let Some(config) = &args.config {
            require_gte!(
                MAX_SPENDING_LIMIT_MEMBERS,
                config.members.len(),
                FutarchyError::TooManySpendingLimitMembers
            );
        }

        Ok(())
    }

    pub fn handle(
        ctx: Context<Self>,
        args: InitializeSpendingLimitChangeProposalArgs,
    ) -> Result<()> {
        let typed_initialize_accounts = &mut ctx.accounts.typed_initialize_accounts;

        let (event_authority, _) =
            Pubkey::find_program_address(&[b"__event_authority"], &crate::ID);

        let set_spending_limit_ix = Instruction {
            program_id: crate::ID,
            accounts: crate::accounts::SetSpendingLimit {
                dao: typed_initialize_accounts.dao.key(),
                squads_multisig_vault: typed_initialize_accounts.dao.squads_multisig_vault,
                event_authority,
                program: crate::ID,
            }
            .to_account_metas(None),
            data: crate::instruction::SetSpendingLimit {
                args: SetSpendingLimitArgs {
                    config: args.config.clone(),
                },
            }
            .data(),
        };

        let event = typed_initialize_accounts.initialize_proposal(
            &[set_spending_limit_ix],
            ProposalAction::SpendingLimitChange {
                config: args.config,
            },
            ctx.bumps.typed_initialize_accounts.proposal,
        )?;

        emit_cpi!(event);

        Ok(())
    }
}
