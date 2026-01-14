use super::*;

#[event_cpi]
#[derive(Accounts)]
pub struct InteractWithVault<'info> {
    pub question: Account<'info, Question>,
    #[account(mut, has_one = question)]
    pub vault: Account<'info, ConditionalVault>,
    #[account(
        mut,
        constraint = vault_underlying_token_account.key() == vault.underlying_token_account @ VaultError::InvalidVaultUnderlyingTokenAccount
    )]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = vault.underlying_token_mint
    )]
    pub user_underlying_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl<'info, 'c: 'info> InteractWithVault<'info> {
    pub fn get_mints_and_user_token_accounts(
        ctx: &Context<'_, '_, 'c, 'info, Self>,
    ) -> Result<(Vec<Account<'info, Mint>>, Vec<Account<'info, TokenAccount>>)> {
        let remaining_accs = &mut ctx.remaining_accounts.iter();

        let expected_num_conditional_tokens = ctx.accounts.question.num_outcomes();
        require_eq!(
            remaining_accs.len(),
            expected_num_conditional_tokens * 2,
            VaultError::InvalidConditionals
        );

        let mut conditional_token_mints = Vec::with_capacity(expected_num_conditional_tokens);
        let mut user_conditional_token_accounts =
            Vec::with_capacity(expected_num_conditional_tokens);

        for i in 0..expected_num_conditional_tokens {
            let conditional_token_mint = next_account_info(remaining_accs)?;
            require_keys_eq!(
                ctx.accounts.vault.conditional_token_mints[i],
                conditional_token_mint.key(),
                VaultError::ConditionalMintMismatch
            );

            // really, this should never fail because we initialize mints when we initialize the vault
            conditional_token_mints.push(
                Account::<Mint>::try_from(conditional_token_mint)
                    .or(Err(VaultError::BadConditionalMint))?,
            );
        }

        for i in 0..expected_num_conditional_tokens {
            let user_conditional_token_account = next_account_info(remaining_accs)?;

            let user_conditional_token_account =
                Account::<TokenAccount>::try_from(user_conditional_token_account)
                    .or(Err(VaultError::BadConditionalTokenAccount))?;

            require_keys_eq!(
                user_conditional_token_account.mint,
                conditional_token_mints[i].key(),
                VaultError::ConditionalTokenMintMismatch
            );

            require_keys_eq!(
                user_conditional_token_account.owner,
                ctx.accounts.authority.key(),
                VaultError::UnauthorizedConditionalTokenAccount
            );

            user_conditional_token_accounts.push(user_conditional_token_account);
        }

        Ok((conditional_token_mints, user_conditional_token_accounts))
    }
}
