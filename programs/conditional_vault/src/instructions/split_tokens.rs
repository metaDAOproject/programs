use super::*;

impl<'info, 'c: 'info> InteractWithVault<'info> {
    pub fn validate_split_tokens(&self) -> Result<()> {
        require!(
            !self.question.is_resolved(),
            VaultError::QuestionAlreadyResolved
        );
        Ok(())
    }

    pub fn handle_split_tokens(ctx: Context<'_, '_, 'c, 'info, Self>, amount: u64) -> Result<()> {
        let accs = &ctx.accounts;

        let (mut conditional_token_mints, mut user_conditional_token_accounts) =
            Self::get_mints_and_user_token_accounts(&ctx)?;

        let pre_vault_underlying_balance = accs.vault_underlying_token_account.amount;
        let pre_conditional_user_balances = user_conditional_token_accounts
            .iter()
            .map(|acc| acc.amount)
            .collect::<Vec<u64>>();
        let pre_conditional_mint_supplies = conditional_token_mints
            .iter()
            .map(|mint| mint.supply)
            .collect::<Vec<u64>>();

        require_gte!(
            accs.user_underlying_token_account.amount,
            amount,
            VaultError::InsufficientUnderlyingTokens
        );

        let vault = &accs.vault;

        let seeds = generate_vault_seeds!(vault);
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new(
                accs.token_program.to_account_info(),
                Transfer {
                    from: accs.user_underlying_token_account.to_account_info(),
                    to: accs.vault_underlying_token_account.to_account_info(),
                    authority: accs.authority.to_account_info(),
                },
            ),
            amount,
        )?;

        for (conditional_mint, user_conditional_token_account) in conditional_token_mints
            .iter()
            .zip(user_conditional_token_accounts.iter())
        {
            token::mint_to(
                CpiContext::new_with_signer(
                    accs.token_program.to_account_info(),
                    MintTo {
                        mint: conditional_mint.to_account_info(),
                        to: user_conditional_token_account.to_account_info(),
                        authority: accs.vault.to_account_info(),
                    },
                    signer,
                ),
                amount,
            )?;
        }

        ctx.accounts.user_underlying_token_account.reload()?;

        ctx.accounts.vault_underlying_token_account.reload()?;
        require_eq!(
            ctx.accounts.vault_underlying_token_account.amount,
            pre_vault_underlying_balance + amount,
            VaultError::AssertFailed
        );

        for (i, mint) in conditional_token_mints.iter_mut().enumerate() {
            mint.reload()?;
            require_eq!(
                mint.supply,
                pre_conditional_mint_supplies[i] + amount,
                VaultError::AssertFailed
            );
        }

        for (i, acc) in user_conditional_token_accounts.iter_mut().enumerate() {
            acc.reload()?;
            require_eq!(
                acc.amount,
                pre_conditional_user_balances[i] + amount,
                VaultError::AssertFailed
            );
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

        let clock = Clock::get()?;
        emit_cpi!(SplitTokensEvent {
            common: CommonFields::new(&clock),
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
