use anchor_lang::prelude::*;
use spl_associated_token_account::instruction::AssociatedTokenAccountInstruction;

pub mod associated_token_program {
    use solana_program::instruction::Instruction;

    use super::*;

    declare_id!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

    pub fn recover_nested<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, RecoverNested<'info>>,
    ) -> Result<()> {

        let instruction_data = AssociatedTokenAccountInstruction::RecoverNested;

        let ix = Instruction {
            program_id: id(),
            accounts: vec![
                AccountMeta::new(ctx.accounts.nested_associated_account_address.key(), false),
                AccountMeta::new_readonly(ctx.accounts.nested_associated_mint_address.key(), false),
                AccountMeta::new(ctx.accounts.destination_associated_account_address.key(), false),
                AccountMeta::new_readonly(ctx.accounts.owner_associated_account_address.key(), false),
                AccountMeta::new_readonly(ctx.accounts.owner_token_mint_address.key(), false),
                AccountMeta::new(ctx.accounts.wallet_address.key(), true),
                AccountMeta::new_readonly(ctx.accounts.token_program_id.key(), false),
            ],
            data: instruction_data.try_to_vec().unwrap()
        };

        solana_program::program::invoke_signed(
            &ix,
            &[
                ctx.accounts.nested_associated_account_address, 
                ctx.accounts.nested_associated_mint_address, 
                ctx.accounts.destination_associated_account_address,
                ctx.accounts.owner_associated_account_address,
                ctx.accounts.owner_token_mint_address,
                ctx.accounts.wallet_address,
                ctx.accounts.token_program_id
            ],
            ctx.signer_seeds,
        )
        .map_err(Into::into)        
    }

    #[derive(Accounts)]
    pub struct RecoverNested<'info> {
        pub nested_associated_account_address: AccountInfo<'info>,
        pub nested_associated_mint_address: AccountInfo<'info>,
        pub destination_associated_account_address: AccountInfo<'info>,
        pub owner_associated_account_address: AccountInfo<'info>,
        pub owner_token_mint_address: AccountInfo<'info>,
        pub wallet_address: AccountInfo<'info>,
        pub token_program_id: AccountInfo<'info>,
    }
}