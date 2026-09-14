use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount},
};
use futarchy::{program::Futarchy, Dao, SpotSwapParams, SwapType};

use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct WithdrawViaSellParams {
    pub amount: u64,
    pub min_quote_out: u64,
}

#[derive(Accounts)]
#[event_cpi]
pub struct WithdrawViaSell<'info> {
    #[account(
        mut,
        has_one = recipient,
        has_one = token_mint,
        has_one = performance_package_token_vault
    )]
    pub performance_package: Box<Account<'info, PerformancePackage>>,

    /// The futarchy Dao whose spot pool buys the tokens
    #[account(
        mut,
        address = performance_package.oracle_config.oracle_account,
        constraint = dao.base_mint == token_mint.key()
    )]
    pub dao: Box<Account<'info, Dao>>,

    /// The token account where locked tokens are stored; the sale is paid out of it
    #[account(mut)]
    pub performance_package_token_vault: Box<Account<'info, TokenAccount>>,

    pub token_mint: Box<Account<'info, Mint>>,

    #[account(address = dao.quote_mint)]
    pub quote_mint: Box<Account<'info, Mint>>,

    #[account(mut, address = dao.amm.amm_base_vault)]
    pub amm_base_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut, address = dao.amm.amm_quote_vault)]
    pub amm_quote_vault: Box<Account<'info, TokenAccount>>,

    /// The package's quote ATA that receives the proceeds before they are forwarded
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = quote_mint,
        associated_token::authority = performance_package
    )]
    pub package_quote_account: Box<Account<'info, TokenAccount>>,

    /// The recipient's quote ATA where the proceeds are sent
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = quote_mint,
        associated_token::authority = recipient
    )]
    pub recipient_quote_account: Box<Account<'info, TokenAccount>>,

    /// Only the recipient can withdraw
    pub recipient: Signer<'info>,

    /// Payer for creating the ATAs if needed
    #[account(mut)]
    pub payer: Signer<'info>,

    pub futarchy_program: Program<'info, Futarchy>,

    /// CHECK: Futarchy's event authority, pinned by its seeds
    #[account(seeds = [b"__event_authority"], bump, seeds::program = futarchy_program)]
    pub futarchy_event_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl WithdrawViaSell<'_> {
    pub fn validate(&self, params: &WithdrawViaSellParams) -> Result<()> {
        PerformancePackage::assert_migrated(&self.performance_package.to_account_info())?;

        require_gt!(params.amount, 0);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: WithdrawViaSellParams) -> Result<()> {
        let Self {
            performance_package,
            dao,
            performance_package_token_vault,
            token_mint: _,
            quote_mint: _,
            amm_base_vault,
            amm_quote_vault,
            package_quote_account,
            recipient_quote_account,
            recipient,
            payer: _,
            futarchy_program,
            futarchy_event_authority,
            system_program: _,
            token_program,
            associated_token_program: _,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let clock = Clock::get()?;
        let now = clock.unix_timestamp;
        let WithdrawViaSellParams {
            amount,
            min_quote_out,
        } = params;

        let withdrawable =
            performance_package.withdrawable(performance_package_token_vault.amount)?;
        require_gte!(
            withdrawable,
            amount,
            PriceBasedPerformancePackageError::InsufficientWithdrawableBalance
        );

        // The token cap is checked before the sale so that a failure moves nothing
        if let Some(policy) = performance_package.active_policy(now) {
            require!(
                policy.limits.withdrawal_mode.allows_sell(),
                PriceBasedPerformancePackageError::WithdrawViaSellDisabled
            );

            policy.roll_if_new_window(now);
            policy.assert_tokens_fit(amount)?;
        }

        let quote_before = package_quote_account.amount;

        let create_key = performance_package.create_key;
        let seeds = &[
            b"performance_package",
            create_key.as_ref(),
            &[performance_package.pda_bump],
        ];
        let signer = &[&seeds[..]];

        futarchy::cpi::spot_swap(
            CpiContext::new_with_signer(
                futarchy_program.to_account_info(),
                futarchy::cpi::accounts::SpotSwap {
                    dao: dao.to_account_info(),
                    user_base_account: performance_package_token_vault.to_account_info(),
                    user_quote_account: package_quote_account.to_account_info(),
                    amm_base_vault: amm_base_vault.to_account_info(),
                    amm_quote_vault: amm_quote_vault.to_account_info(),
                    user: performance_package.to_account_info(),
                    token_program: token_program.to_account_info(),
                    event_authority: futarchy_event_authority.to_account_info(),
                    program: futarchy_program.to_account_info(),
                },
                signer,
            ),
            SpotSwapParams {
                input_amount: amount,
                swap_type: SwapType::Sell,
                min_output_amount: min_quote_out,
            },
        )?;

        package_quote_account.reload()?;
        let quote_received = package_quote_account
            .amount
            .checked_sub(quote_before)
            .ok_or(PriceBasedPerformancePackageError::InvariantViolated)?;

        // The quote cap is checked against what the pool actually paid; a failure fails the transaction, sale included
        let capped = match performance_package.active_policy(now) {
            Some(policy) => {
                // Fail the transaction if the quote cap is exceeded
                policy.assert_quote_fits(quote_received)?;
                policy.record_withdrawal(amount, quote_received);

                Some(policy.usage)
            }
            None => None,
        };

        // Forward exactly what the pool paid
        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                token::Transfer {
                    from: package_quote_account.to_account_info(),
                    to: recipient_quote_account.to_account_info(),
                    authority: performance_package.to_account_info(),
                },
                signer,
            ),
            quote_received,
        )?;

        performance_package.seq_num += 1;

        emit_cpi!(TokensSold {
            common: CommonFields::new(&clock, performance_package.seq_num),
            performance_package: performance_package.key(),
            recipient: recipient.key(),
            amount,
            quote_received,
            min_quote_out,
            capped,
        });

        Ok(())
    }
}
