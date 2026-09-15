use super::*;

mod admin {
    use anchor_lang::prelude::declare_id;

    // MetaDAO ops multisig — the same signer as the approval enqueue
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct AdminEnqueueMultisigProposalCancellationArgs {
    pub transaction_index: u64,
}

#[derive(Accounts)]
#[instruction(args: AdminEnqueueMultisigProposalCancellationArgs)]
pub struct AdminEnqueueMultisigProposalCancellation<'info> {
    #[account(has_one = squads_multisig)]
    pub dao: Account<'info, Dao>,

    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [
            squads_multisig_program::SEED_PREFIX,
            squads_multisig_program::SEED_MULTISIG,
            dao.key().as_ref(),
        ],
        bump,
        seeds::program = squads_multisig_program::ID,
    )]
    pub squads_multisig: Account<'info, squads_multisig_program::Multisig>,

    #[account(
        seeds = [
            squads_multisig_program::SEED_PREFIX,
            squads_multisig.key().as_ref(),
            squads_multisig_program::SEED_TRANSACTION,
            args.transaction_index.to_le_bytes().as_ref(),
            squads_multisig_program::SEED_PROPOSAL,
        ],
        bump,
        seeds::program = squads_multisig_program::ID,
    )]
    pub squads_multisig_proposal: Account<'info, squads_multisig_program::Proposal>,

    #[account(
        init,
        payer = admin,
        space = 8 + EnqueuedMultisigProposalCancellation::INIT_SPACE,
        seeds = [
            SEED_ENQUEUED_MULTISIG_PROPOSAL_CANCELLATION,
            dao.key().as_ref(),
            args.transaction_index.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub enqueued_cancellation: Account<'info, EnqueuedMultisigProposalCancellation>,

    pub system_program: Program<'info, System>,
}

impl AdminEnqueueMultisigProposalCancellation<'_> {
    pub fn validate(&self, _args: &AdminEnqueueMultisigProposalCancellationArgs) -> Result<()> {
        // Ensure the DAO is migrated before reading `liquidator`.
        Dao::assert_migrated(&self.dao.to_account_info())?;

        // On a liquidated DAO the liquidator replaces the admin id as the
        // required signer. Enqueueing is the only capability the liquidator
        // gains: the cancel leg stays permissionless.
        match self.dao.liquidator {
            Some(liquidator) => {
                require_keys_eq!(
                    self.admin.key(),
                    liquidator,
                    FutarchyError::InvalidLiquidator
                );
            }
            None => {
                #[cfg(feature = "production")]
                require_keys_eq!(self.admin.key(), admin::ID, FutarchyError::InvalidAdmin);
            }
        }

        validate_squads_proposal_for_cancellation(
            &self.squads_multisig_proposal,
            &self.dao.squads_multisig,
        )?;

        Ok(())
    }

    pub fn handle(
        ctx: Context<Self>,
        args: AdminEnqueueMultisigProposalCancellationArgs,
    ) -> Result<()> {
        let enqueued = &mut ctx.accounts.enqueued_cancellation;

        enqueued.dao = ctx.accounts.dao.key();
        enqueued.transaction_index = args.transaction_index;
        enqueued.pda_bump = ctx.bumps.enqueued_cancellation;

        Ok(())
    }
}

/// A cancellation targets an `Approved` proposal. Squads permits cancelling a
/// stale proposal, so there is no stale-index check here.
pub fn validate_squads_proposal_for_cancellation(
    squads_proposal: &squads_multisig_program::Proposal,
    dao_multisig_key: &Pubkey,
) -> Result<()> {
    require_keys_eq!(squads_proposal.multisig, *dao_multisig_key);

    require!(
        matches!(
            squads_proposal.status,
            squads_multisig_program::ProposalStatus::Approved { .. }
        ),
        FutarchyError::SquadsProposalNotApproved
    );

    Ok(())
}
