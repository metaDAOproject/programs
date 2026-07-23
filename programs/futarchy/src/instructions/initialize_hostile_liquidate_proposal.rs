use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::InstructionData;

use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeHostileLiquidateProposalArgs {
    pub liquidator: Pubkey,
}

#[derive(Accounts)]
#[event_cpi]
pub struct InitializeHostileLiquidateProposal<'info> {
    pub create: TypedCreateAccounts<'info>,
}

impl InitializeHostileLiquidateProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        self.create.validate()
    }

    pub fn handle(ctx: Context<Self>, args: InitializeHostileLiquidateProposalArgs) -> Result<()> {
        let create = &mut ctx.accounts.create;
        let dao = &create.dao;

        let (event_authority, _) =
            Pubkey::find_program_address(&[b"__event_authority"], &crate::ID);

        // The treasury's own LP position: the Squads vault is the position
        // authority. May not exist — apply_liquidation tolerates that.
        let (amm_position, _) = Pubkey::find_program_address(
            &[
                SEED_AMM_POSITION,
                dao.key().as_ref(),
                dao.squads_multisig_vault.as_ref(),
            ],
            &crate::ID,
        );

        // The payload calls back into this program. The first account is this
        // proposal's own PDA — knowable here because it is seeded on the
        // Squads proposal this instruction creates at the next transaction
        // index (the proposal_create CPI enforces that address).
        let apply_liquidation_ix = Instruction {
            program_id: crate::ID,
            accounts: crate::accounts::ApplyLiquidation {
                proposal: create.proposal.key(),
                dao: dao.key(),
                squads_multisig_vault: dao.squads_multisig_vault,
                amm_position,
                amm_base_vault: dao.amm.amm_base_vault,
                amm_quote_vault: dao.amm.amm_quote_vault,
                vault_base_account: anchor_spl::associated_token::get_associated_token_address(
                    &dao.squads_multisig_vault,
                    &dao.base_mint,
                ),
                vault_quote_account: anchor_spl::associated_token::get_associated_token_address(
                    &dao.squads_multisig_vault,
                    &dao.quote_mint,
                ),
                token_program: token::ID,
                event_authority,
                program: crate::ID,
            }
            .to_account_metas(None),
            data: crate::instruction::ApplyLiquidation.data(),
        };

        let event = create.create_proposal(
            &[apply_liquidation_ix],
            ProposalAction::HostileLiquidate {
                liquidator: args.liquidator,
            },
            ctx.bumps.create.proposal,
        )?;

        emit_cpi!(event);

        Ok(())
    }
}
