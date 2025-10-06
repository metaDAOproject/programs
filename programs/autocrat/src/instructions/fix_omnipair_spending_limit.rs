use super::*;

use squads_multisig_program::{program::SquadsMultisigProgram, Member, Multisig, MultisigAddSpendingLimitArgs, MultisigRemoveSpendingLimitArgs, Period, Permission, Permissions, SpendingLimit};

pub mod kollan_address {
    use anchor_lang::prelude::declare_id;
    declare_id!("tSTp6B6kE9o6ZaTmHm2ZwnJBBtgd3x112tapxFhmBEQ");
}

pub mod omnpair_dao {
    use anchor_lang::prelude::declare_id;

    declare_id!("B3AufDZCDtQN8JxZgJ5bSDZaiKCF4vtw7ynN9tuR9pXN");
}

pub mod omnipair_spending_limit {
    use anchor_lang::prelude::declare_id;

    declare_id!("5gn6mBnPqp4AQUXyanadwcse8eVqUNFxnc2zrKJV8kCn");
}

pub mod rakka_address {
    use anchor_lang::prelude::declare_id;

    declare_id!("5jRqFejxKHWMfR69dbYF2A9TnpnBPjz7iaRQS44imcMi");
}

#[derive(Accounts)]
pub struct FixOmnipairSpendingLimit<'info> {
    #[account(mut, has_one = squads_multisig, address = omnpair_dao::id())]
    pub dao: Box<Account<'info, Dao>>,
    #[account(mut)]
    pub squads_multisig: Account<'info, Multisig>,
    pub squads_multisig_program: Program<'info, SquadsMultisigProgram>,
    #[account(mut)]
    pub rent_payer: Signer<'info>,
    pub kollan: Signer<'info>,
    #[account(mut, address = omnipair_spending_limit::id())]
    pub omnipair_spending_limit: Account<'info, SpendingLimit>,
    pub system_program: Program<'info, System>,
}

impl FixOmnipairSpendingLimit<'_> {
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
            kollan: _,
            system_program,
            omnipair_spending_limit,
        } = ctx.accounts;

        let dao_nonce = &dao.nonce.to_le_bytes();
        let dao_creator_key = &dao.dao_creator.as_ref();
        let dao_seeds = &[b"dao".as_ref(), dao_creator_key, dao_nonce, &[dao.pda_bump]];
        let dao_signer = &[&dao_seeds[..]];

        squads_multisig_program::cpi::multisig_remove_spending_limit(
            CpiContext::new_with_signer(
                squads_multisig_program.to_account_info(),
                squads_multisig_program::cpi::accounts::MultisigRemoveSpendingLimit {
                    multisig: squads_multisig.to_account_info(),
                    config_authority: dao.to_account_info(),
                    spending_limit: omnipair_spending_limit.to_account_info(),
                    rent_collector: rent_payer.to_account_info(),
                },
                dao_signer,
            ),
            MultisigRemoveSpendingLimitArgs {
                memo: None,
            }
        )?;

        squads_multisig_program::cpi::multisig_add_spending_limit(
            CpiContext::new_with_signer(
                squads_multisig_program.to_account_info(),
                squads_multisig_program::cpi::accounts::MultisigAddSpendingLimit {
                    multisig: squads_multisig.to_account_info(),
                    config_authority: dao.to_account_info(),
                    spending_limit: omnipair_spending_limit.to_account_info(),
                    rent_payer: rent_payer.to_account_info(),
                    system_program: system_program.to_account_info(),
                },
                dao_signer,
            ),
            MultisigAddSpendingLimitArgs {
                memo: None,
                create_key: dao.key(),
                vault_index: 0,
                mint: dao.quote_mint,
                amount: 50_000 * 1_000_000,
                period: Period::Month,
                members: vec![rakka_address::id()],
                destinations: vec![],
            }
        )?;

        Ok(())
    }
}
