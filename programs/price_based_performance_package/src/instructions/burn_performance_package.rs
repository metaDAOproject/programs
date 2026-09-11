use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, Token, TokenAccount},
};

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
        has_one = recipient,
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

    /// CHECK: Pinned to the package's recipient by `has_one`
    pub recipient: UncheckedAccount<'info>,

    /// The recipient's ATA that receives the unlocked balance - created if needed
    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = token_mint,
        associated_token::authority = recipient
    )]
    pub recipient_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: SOL from account closures go to this account
    #[account(mut)]
    pub spill_account: UncheckedAccount<'info>,

    #[account(mut, address = performance_package.token_mint)]
    pub token_mint: Box<Account<'info, Mint>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl BurnPerformancePackage<'_> {
    pub fn validate(&self) -> Result<()> {
        PerformancePackage::assert_migrated(&self.performance_package.to_account_info())?;

        #[cfg(feature = "production")]
        require_keys_eq!(
            self.admin.key(),
            admin::ID,
            PriceBasedPerformancePackageError::InvalidAdmin
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let Self {
            performance_package,
            performance_package_token_vault,
            recipient: _,
            recipient_token_account,
            admin: _,
            spill_account: _,
            token_mint,
            system_program: _,
            token_program,
            associated_token_program: _,
        } = ctx.accounts;

        let vault_amount = performance_package_token_vault.amount;
        let withdrawable = performance_package.withdrawable(vault_amount)?;
        let locked = vault_amount
            .checked_sub(withdrawable)
            .ok_or(PriceBasedPerformancePackageError::InvariantViolated)?;

        let seeds = &[
            b"performance_package",
            performance_package.create_key.as_ref(),
            &[performance_package.pda_bump],
        ];
        let signer = &[&seeds[..]];

        // Hand the recipient what is already unlocked before burning the rest
        if withdrawable > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    token_program.to_account_info(),
                    token::Transfer {
                        from: performance_package_token_vault.to_account_info(),
                        to: recipient_token_account.to_account_info(),
                        authority: performance_package.to_account_info(),
                    },
                    signer,
                ),
                withdrawable,
            )?;
        }

        if locked > 0 {
            token::burn(
                CpiContext::new_with_signer(
                    token_program.to_account_info(),
                    Burn {
                        mint: token_mint.to_account_info(),
                        from: performance_package_token_vault.to_account_info(),
                        authority: performance_package.to_account_info(),
                    },
                    signer,
                ),
                locked,
            )?;
        }

        // Performance package account gets closed using close constraint

        Ok(())
    }
}
