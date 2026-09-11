use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount},
};

use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct WithdrawTokensParams {
    pub amount: u64,
}

#[derive(Accounts)]
#[event_cpi]
pub struct WithdrawTokens<'info> {
    #[account(
        mut,
        has_one = recipient,
        has_one = token_mint,
        has_one = performance_package_token_vault
    )]
    pub performance_package: Box<Account<'info, PerformancePackage>>,

    /// CHECK: Only read while a withdrawal policy is active
    #[account(address = performance_package.oracle_config.oracle_account)]
    pub oracle_account: UncheckedAccount<'info>,

    /// The token account where locked tokens are stored
    #[account(mut)]
    pub performance_package_token_vault: Box<Account<'info, TokenAccount>>,

    pub token_mint: Box<Account<'info, Mint>>,

    /// The recipient's ATA where tokens will be sent - created if needed
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = recipient
    )]
    pub recipient_token_account: Box<Account<'info, TokenAccount>>,

    /// Only the recipient can withdraw
    pub recipient: Signer<'info>,

    /// Payer for creating the ATA if needed
    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl WithdrawTokens<'_> {
    pub fn validate(&self, params: &WithdrawTokensParams) -> Result<()> {
        PerformancePackage::assert_migrated(&self.performance_package.to_account_info())?;

        require_gt!(params.amount, 0);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: WithdrawTokensParams) -> Result<()> {
        let Self {
            performance_package,
            oracle_account: _,
            performance_package_token_vault,
            token_mint: _,
            recipient_token_account,
            recipient,
            payer: _,
            system_program: _,
            token_program,
            associated_token_program: _,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let clock = Clock::get()?;
        let WithdrawTokensParams { amount } = params;

        let withdrawable =
            performance_package.withdrawable(performance_package_token_vault.amount)?;
        require_gte!(
            withdrawable,
            amount,
            PriceBasedPerformancePackageError::InsufficientWithdrawableBalance
        );

        let seeds = &[
            b"performance_package",
            performance_package.create_key.as_ref(),
            &[performance_package.pda_bump],
        ];
        let signer = &[&seeds[..]];

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
            amount,
        )?;

        performance_package.seq_num += 1;

        emit_cpi!(TokensWithdrawn {
            common: CommonFields::new(&clock, performance_package.seq_num),
            performance_package: performance_package.key(),
            recipient: recipient.key(),
            amount,
            capped: None,
        });

        Ok(())
    }
}
