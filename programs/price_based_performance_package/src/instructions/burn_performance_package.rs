use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use super::*;

pub mod admin {
    use anchor_lang::prelude::declare_id;

    // MetaDAO multisig
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

#[derive(Accounts)]
pub struct BurnPerformancePackage<'info> {
    #[account(
        mut,
        close = spill_account,
        has_one = token_mint,
        has_one = performance_package_token_vault
    )]
    pub performance_package: Box<Account<'info, PerformancePackage>>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = performance_package
    )]
    pub performance_package_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: SOL from account closures go to this account
    #[account(mut)]
    pub spill_account: UncheckedAccount<'info>,

    #[account(mut, address = performance_package.token_mint)]
    pub token_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

impl BurnPerformancePackage<'_> {
    pub fn validate(&self) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(
            self.admin.key(),
            admin::ID,
            PriceBasedPerformancePackageError::InvalidAdmin
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let performance_package = &ctx.accounts.performance_package;

        let seeds = &[
            b"performance_package",
            performance_package.create_key.as_ref(),
            &[performance_package.pda_bump],
        ];
        let signer = &[&seeds[..]];

        // Burn any remaining tokens in the performance package token vault
        if ctx.accounts.performance_package_token_vault.amount > 0 {
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.token_mint.to_account_info(),
                        from: ctx
                            .accounts
                            .performance_package_token_vault
                            .to_account_info(),
                        authority: performance_package.to_account_info(),
                    },
                    signer,
                ),
                ctx.accounts.performance_package_token_vault.amount,
            )?;
        }

        // Performance package account gets closed using close constraint

        Ok(())
    }
}
