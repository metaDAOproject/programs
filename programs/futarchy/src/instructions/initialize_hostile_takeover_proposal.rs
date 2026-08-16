use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::InstructionData;

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
        self.typed_initialize_accounts.validate()?;

        if let SpendingLimitAction::Set(config) = &args.spending_limit_action {
            config.validate()?;
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: InitializeHostileTakeoverProposalArgs) -> Result<()> {
        let typed_initialize_accounts = &mut ctx.accounts.typed_initialize_accounts;

        let (event_authority, _) =
            Pubkey::find_program_address(&[b"__event_authority"], &crate::ID);

        let update_dao_ix = Instruction {
            program_id: crate::ID,
            accounts: crate::accounts::UpdateDao {
                dao: typed_initialize_accounts.dao.key(),
                squads_multisig_vault: typed_initialize_accounts.dao.squads_multisig_vault,
                event_authority,
                program: crate::ID,
            }
            .to_account_metas(None),
            data: crate::instruction::UpdateDao {
                dao_params: UpdateDaoParams {
                    pass_threshold_bps: None,
                    seconds_per_proposal: None,
                    twap_initial_observation: None,
                    twap_max_observation_change_per_update: None,
                    twap_start_delay_seconds: None,
                    min_quote_futarchic_liquidity: None,
                    min_base_futarchic_liquidity: None,
                    base_to_stake: None,
                    team_sponsored_pass_threshold_bps: None,
                    team_address: Some(args.new_team_address),
                    is_optimistic_governance_enabled: None,
                },
            }
            .data(),
        };

        let mut instructions = vec![update_dao_ix];

        // `Keep` bakes no second instruction; `Remove`/`Set` append a
        // vault-signed set_spending_limit carrying the declared end state.
        let spending_limit_config = match &args.spending_limit_action {
            SpendingLimitAction::Keep => None,
            SpendingLimitAction::Remove => Some(SetSpendingLimitArgs { config: None }),
            SpendingLimitAction::Set(limit) => Some(SetSpendingLimitArgs {
                config: Some(limit.clone()),
            }),
        };

        if let Some(set_spending_limit_args) = spending_limit_config {
            instructions.push(Instruction {
                program_id: crate::ID,
                accounts: crate::accounts::SetSpendingLimit {
                    dao: typed_initialize_accounts.dao.key(),
                    squads_multisig_vault: typed_initialize_accounts.dao.squads_multisig_vault,
                    event_authority,
                    program: crate::ID,
                }
                .to_account_metas(None),
                data: crate::instruction::SetSpendingLimit {
                    args: set_spending_limit_args,
                }
                .data(),
            });
        }

        let event = typed_initialize_accounts.initialize_proposal(
            &instructions,
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
