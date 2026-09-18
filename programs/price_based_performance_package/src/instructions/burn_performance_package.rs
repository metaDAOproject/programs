use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, CloseAccount, Mint, Token, TokenAccount},
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

    /// Emptied by the payout and the burn, then closed to the spill account
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

    /// The mint of the package's quote ATA; any mint other than the package's token mint
    pub quote_mint: Option<Box<Account<'info, Mint>>>,

    /// The package's quote ATA, swept into `quote_destination` and closed when passed
    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = performance_package
    )]
    pub package_quote_account: Option<Box<Account<'info, TokenAccount>>>,

    /// Where the quote balance goes, chosen by the admin
    #[account(mut, token::mint = quote_mint)]
    pub quote_destination: Option<Box<Account<'info, TokenAccount>>>,

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

        // Ensure the quote mint is not the package's token mint.
        if let Some(quote_mint) = &self.quote_mint {
            require_keys_neq!(
                quote_mint.key(),
                self.token_mint.key(),
                PriceBasedPerformancePackageError::InvalidQuoteMint
            );
        }

        // Ensure the quote account and its destination are passed together.
        require_eq!(
            self.package_quote_account.is_some(),
            self.quote_destination.is_some(),
            PriceBasedPerformancePackageError::QuoteSweepAccountsIncomplete
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
            spill_account,
            token_mint,
            quote_mint: _,
            package_quote_account,
            quote_destination,
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

        // The vault is empty now, so its rent goes to the spill account
        token::close_account(CpiContext::new_with_signer(
            token_program.to_account_info(),
            CloseAccount {
                account: performance_package_token_vault.to_account_info(),
                destination: spill_account.to_account_info(),
                authority: performance_package.to_account_info(),
            },
            signer,
        ))?;

        // Move whatever sits in the quote account to the admin's destination, then close it
        if let (Some(package_quote_account), Some(quote_destination)) =
            (package_quote_account, quote_destination)
        {
            if package_quote_account.amount > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        token_program.to_account_info(),
                        token::Transfer {
                            from: package_quote_account.to_account_info(),
                            to: quote_destination.to_account_info(),
                            authority: performance_package.to_account_info(),
                        },
                        signer,
                    ),
                    package_quote_account.amount,
                )?;
            }

            token::close_account(CpiContext::new_with_signer(
                token_program.to_account_info(),
                CloseAccount {
                    account: package_quote_account.to_account_info(),
                    destination: spill_account.to_account_info(),
                    authority: performance_package.to_account_info(),
                },
                signer,
            ))?;
        }

        // Performance package account gets closed using close constraint

        Ok(())
    }
}
