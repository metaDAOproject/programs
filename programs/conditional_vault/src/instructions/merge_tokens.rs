use super::*;

impl<'info, 'c: 'info> InteractWithVault<'info> {
    pub fn handle_merge_tokens(ctx: Context<'_, '_, 'c, 'info, Self>, amount: u64) -> Result<()> {
        let accs = &ctx.accounts;

        let (mut conditional_token_mints, mut user_conditional_token_accounts) =
            Self::get_mints_and_user_token_accounts(&ctx)?;

        for conditional_token_account in user_conditional_token_accounts.iter() {
            require!(
                conditional_token_account.amount >= amount,
                VaultError::InsufficientConditionalTokens
            );
        }

        let vault = &accs.vault;

        let pre_user_underlying_balance = accs.user_underlying_token_account.amount;
        let pre_vault_underlying_balance = accs.vault_underlying_token_account.amount;

        let expected_future_balances: Vec<u64> = user_conditional_token_accounts
            .iter()
            .map(|account| account.amount - amount)
            .collect();
        let expected_future_supplies: Vec<u64> = conditional_token_mints
            .iter()
            .map(|mint| mint.supply - amount)
            .collect();

        let seeds = generate_vault_seeds!(vault);
        let signer = &[&seeds[..]];

        for (conditional_mint, user_conditional_token_account) in conditional_token_mints
            .iter()
            .zip(user_conditional_token_accounts.iter())
        {
            token::burn(
                CpiContext::new(
                    accs.token_program.to_account_info(),
                    Burn {
                        mint: conditional_mint.to_account_info(),
                        from: user_conditional_token_account.to_account_info(),
                        authority: accs.authority.to_account_info(),
                    },
                ),
                amount,
            )?;
        }

        // Transfer `amount` from vault to user
        token::transfer(
            CpiContext::new_with_signer(
                accs.token_program.to_account_info(),
                Transfer {
                    from: accs.vault_underlying_token_account.to_account_info(),
                    to: accs.user_underlying_token_account.to_account_info(),
                    authority: accs.vault.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        ctx.accounts.user_underlying_token_account.reload()?;
        ctx.accounts.vault_underlying_token_account.reload()?;

        require_eq!(
            ctx.accounts.user_underlying_token_account.amount,
            pre_user_underlying_balance + amount,
            VaultError::AssertFailed
        );
        require_eq!(
            ctx.accounts.vault_underlying_token_account.amount,
            pre_vault_underlying_balance - amount,
            VaultError::AssertFailed
        );

        for (mint, expected_supply) in conditional_token_mints
            .iter_mut()
            .zip(expected_future_supplies.iter())
        {
            mint.reload()?;
            require_eq!(mint.supply, *expected_supply, VaultError::AssertFailed);
        }

        for (account, expected_balance) in user_conditional_token_accounts
            .iter_mut()
            .zip(expected_future_balances.iter())
        {
            account.reload()?;
            require_eq!(account.amount, *expected_balance, VaultError::AssertFailed);
        }

        ctx.accounts.vault.invariant(
            &ctx.accounts.question,
            conditional_token_mints
                .iter()
                .map(|mint| mint.supply)
                .collect::<Vec<u64>>(),
            ctx.accounts.vault_underlying_token_account.amount,
        )?;

        ctx.accounts.vault.seq_num += 1;

        emit_cpi!(MergeTokensEvent {
            common: CommonFields {
                slot: Clock::get()?.slot,
                unix_timestamp: Clock::get()?.unix_timestamp,
            },
            user: ctx.accounts.authority.key(),
            vault: ctx.accounts.vault.key(),
            amount,
            post_user_underlying_balance: ctx.accounts.user_underlying_token_account.amount,
            post_vault_underlying_balance: ctx.accounts.vault_underlying_token_account.amount,
            post_user_conditional_token_balances: user_conditional_token_accounts
                .iter()
                .map(|account| account.amount)
                .collect(),
            post_conditional_token_supplies: conditional_token_mints
                .iter()
                .map(|mint| mint.supply)
                .collect(),
            seq_num: ctx.accounts.vault.seq_num,
        });

        Ok(())
    }
}
