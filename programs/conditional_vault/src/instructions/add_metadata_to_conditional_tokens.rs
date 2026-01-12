use super::*;

pub mod proph3t_deployer {
    use anchor_lang::declare_id;

    declare_id!("613BRiXuAEn7vibs2oAYzpGW9fXgjzDNuFMM4wPzLdY");
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AddMetadataToConditionalTokensArgs {
    pub name: String,
    pub symbol: String,
    pub uri: String,
}

#[event_cpi]
#[derive(Accounts)]
pub struct AddMetadataToConditionalTokens<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, ConditionalVault>,
    #[account(mint::authority = vault)]
    pub conditional_token_mint: Account<'info, Mint>,
    /// CHECK: verified via cpi into token metadata
    #[account(mut)]
    pub conditional_token_metadata: AccountInfo<'info>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl AddMetadataToConditionalTokens<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.vault
                .conditional_token_mints
                .contains(&self.conditional_token_mint.key()),
            VaultError::InvalidConditionalTokenMint
        );

        require!(
            self.conditional_token_metadata.data_is_empty(),
            VaultError::ConditionalTokenMetadataAlreadySet
        );

        #[cfg(feature = "production")]
        require_eq!(self.payer.key(), proph3t_deployer::ID);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: AddMetadataToConditionalTokensArgs) -> Result<()> {
        let seeds = generate_vault_seeds!(ctx.accounts.vault);
        let signer_seeds = &[&seeds[..]];

        let cpi_program = ctx.accounts.token_metadata_program.to_account_info();

        let cpi_accounts = CreateMetadataAccountsV3 {
            metadata: ctx.accounts.conditional_token_metadata.to_account_info(),
            mint: ctx.accounts.conditional_token_mint.to_account_info(),
            mint_authority: ctx.accounts.vault.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            update_authority: ctx.accounts.vault.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };

        create_metadata_accounts_v3(
            CpiContext::new(cpi_program, cpi_accounts).with_signer(signer_seeds),
            DataV2 {
                name: args.name.clone(),
                symbol: args.symbol.clone(),
                uri: args.uri.clone(),
                seller_fee_basis_points: 0,
                creators: None,
                collection: None,
                uses: None,
            },
            false,
            true,
            None,
        )?;

        ctx.accounts.vault.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(AddMetadataToConditionalTokensEvent {
            common: CommonFields::new(&clock),
            vault: ctx.accounts.vault.key(),
            conditional_token_mint: ctx.accounts.conditional_token_mint.key(),
            conditional_token_metadata: ctx.accounts.conditional_token_metadata.key(),
            name: args.name,
            symbol: args.symbol,
            uri: args.uri,
            seq_num: ctx.accounts.vault.seq_num,
        });

        Ok(())
    }
}
