use super::*;

impl<'info, 'c: 'info> InteractWithVault<'info> {
    pub fn validate_redeem_tokens(&self) -> Result<()> {
        require!(
            self.question.is_resolved(),
            VaultError::CantRedeemConditionalTokens
        );

        Ok(())
    }

    pub fn handle_redeem_tokens(ctx: Context<'_, '_, 'c, 'info, Self>) -> Result<()> {
        let accs = &ctx.accounts;

        let (mut conditional_token_mints, mut user_conditional_token_accounts) =
            Self::get_mints_and_user_token_accounts(&ctx)?;

        // calculate the expected future supplies of the conditional token mints
        // as current supply - user balance
        let expected_future_supplies: Vec<u64> = conditional_token_mints
            .iter()
            .zip(user_conditional_token_accounts.iter())
            .map(|(mint, account)| mint.supply - account.amount)
            .collect();

        let vault = &accs.vault;
        let question = &accs.question;

        let seeds = generate_vault_seeds!(vault);
        let signer = &[&seeds[..]];

        let pre_user_underlying_balance = accs.user_underlying_token_account.amount;
        let pre_vault_underlying_balance = accs.vault_underlying_token_account.amount;
        // safe because there are always at least two conditional tokens and thus
        // at least two user conditional token accounts
        let max_redeemable = user_conditional_token_accounts
            .iter()
            .map(|account| account.amount)
            .max()
            .unwrap();

        let mut total_numerator: u128 = 0;

        for (payout_index, (conditional_mint, user_conditional_token_account)) in
            conditional_token_mints
                .iter()
                .zip(user_conditional_token_accounts.iter())
                .enumerate()
        {
            total_numerator += user_conditional_token_account.amount as u128
                * question.payout_numerators[payout_index] as u128;

            token::burn(
                CpiContext::new(
                    accs.token_program.to_account_info(),
                    Burn {
                        mint: conditional_mint.to_account_info(),
                        from: user_conditional_token_account.to_account_info(),
                        authority: accs.authority.to_account_info(),
                    },
                ),
                user_conditional_token_account.amount,
            )?;
        }

        let total_redeemable = (total_numerator / question.payout_denominator as u128) as u64;

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
            total_redeemable,
        )?;

        require_gte!(max_redeemable, total_redeemable, VaultError::AssertFailed);

        ctx.accounts.user_underlying_token_account.reload()?;
        ctx.accounts.vault_underlying_token_account.reload()?;

        require_eq!(
            ctx.accounts.user_underlying_token_account.amount,
            pre_user_underlying_balance + total_redeemable,
            VaultError::AssertFailed
        );

        require_eq!(
            ctx.accounts.vault_underlying_token_account.amount,
            pre_vault_underlying_balance - total_redeemable,
            VaultError::AssertFailed
        );

        for acc in user_conditional_token_accounts.iter_mut() {
            acc.reload()?;
            require_eq!(acc.amount, 0, VaultError::AssertFailed);
        }

        for (mint, expected_supply) in conditional_token_mints
            .iter_mut()
            .zip(expected_future_supplies.iter())
        {
            mint.reload()?;
            require_eq!(mint.supply, *expected_supply, VaultError::AssertFailed);
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
        emit_cpi!(RedeemTokensEvent {
            common: CommonFields::new(&clock),
            user: ctx.accounts.authority.key(),
            vault: ctx.accounts.vault.key(),
            amount: total_redeemable,
            post_user_underlying_balance: ctx.accounts.user_underlying_token_account.amount,
            post_vault_underlying_balance: ctx.accounts.vault_underlying_token_account.amount,
            post_conditional_token_supplies: conditional_token_mints
                .iter()
                .map(|mint| mint.supply)
                .collect(),
            seq_num: ctx.accounts.vault.seq_num,
        });

        Ok(())
    }
}
