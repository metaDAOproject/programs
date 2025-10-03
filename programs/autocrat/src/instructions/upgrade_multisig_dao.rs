use super::*;

use squads_multisig_program::{program::SquadsMultisigProgram, Member, MultisigAddMemberArgs, MultisigRemoveMemberArgs, Permission, Permissions, Multisig};

pub mod kollan_address {
    use anchor_lang::prelude::declare_id;
    declare_id!("tSTp6B6kE9o6ZaTmHm2ZwnJBBtgd3x112tapxFhmBEQ");
}

#[derive(Accounts)]
pub struct UpgradeMultisigDao<'info> {
    #[account(mut, has_one = squads_multisig)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(mut)]
    pub squads_multisig: Account<'info, Multisig>,
    pub squads_multisig_program: Program<'info, SquadsMultisigProgram>,
    #[account(mut)]
    pub rent_payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub kollan: Signer<'info>,
}

impl UpgradeMultisigDao<'_> {
    pub fn validate(&self) -> Result<()> {
        // #[cfg(feature = "production")]
        require_eq!(self.kollan.key(), kollan_address::id());

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let Self {
            dao,
            squads_multisig,
            squads_multisig_program,
            rent_payer,
            system_program,
            kollan: _,
        } = ctx.accounts;

        let dao_nonce = &dao.nonce.to_le_bytes();
        let dao_creator_key = &dao.dao_creator.as_ref();
        let dao_seeds = &[b"dao".as_ref(), dao_creator_key, dao_nonce, &[dao.pda_bump]];
        let dao_signer = &[&dao_seeds[..]];

        squads_multisig_program::cpi::multisig_add_member(
            CpiContext::new_with_signer(
                squads_multisig_program.to_account_info(),
                squads_multisig_program::cpi::accounts::MultisigConfig {
                    multisig: squads_multisig.to_account_info(),
                    config_authority: dao.to_account_info(),
                    rent_payer: Some(rent_payer.to_account_info()),
                    system_program: Some(system_program.to_account_info()),
                },
                dao_signer,
            ),
            MultisigAddMemberArgs {
                new_member: Member {
                    key: system_program.key(),
                    permissions: Permissions::from_vec(&[Permission::Vote, Permission::Execute]),
                },
                memo: None,
            }
        )?;

        squads_multisig_program::cpi::multisig_remove_member(
            CpiContext::new_with_signer(
                squads_multisig_program.to_account_info(),
                squads_multisig_program::cpi::accounts::MultisigConfig {
                    multisig: squads_multisig.to_account_info(),
                    config_authority: dao.to_account_info(),
                    rent_payer: Some(rent_payer.to_account_info()),
                    system_program: Some(system_program.to_account_info()),
                },
                dao_signer,
            ),
            MultisigRemoveMemberArgs {
                old_member: dao.key(),
                memo: None,
            }
        )?;

        squads_multisig_program::cpi::multisig_add_member(
            CpiContext::new_with_signer(
                squads_multisig_program.to_account_info(),
                squads_multisig_program::cpi::accounts::MultisigConfig {
                    multisig: squads_multisig.to_account_info(),
                    config_authority: dao.to_account_info(),
                    rent_payer: Some(rent_payer.to_account_info()),
                    system_program: Some(system_program.to_account_info()),
                },
                dao_signer,
            ),
            MultisigAddMemberArgs {
                new_member: Member {
                    key: dao.key(),
                    permissions: Permissions::from_vec(&[Permission::Vote, Permission::Execute]),
                },
                memo: None,
            }
        )?;

        squads_multisig_program::cpi::multisig_remove_member(
            CpiContext::new_with_signer(
                squads_multisig_program.to_account_info(),
                squads_multisig_program::cpi::accounts::MultisigConfig {
                    multisig: squads_multisig.to_account_info(),
                    config_authority: dao.to_account_info(),
                    rent_payer: Some(rent_payer.to_account_info()),
                    system_program: Some(system_program.to_account_info()),
                },
                dao_signer,
            ),
            MultisigRemoveMemberArgs {
                old_member: system_program.key(),
                memo: None,
            }
        )?;

        Ok(())
    }
}
