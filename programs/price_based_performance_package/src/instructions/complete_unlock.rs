use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount}
};

use super::*;

#[derive(Accounts)]
#[event_cpi]
pub struct CompleteUnlock<'info> {
    #[account(mut, has_one = token_mint, has_one = performance_package_token_vault)]
    pub performance_package: Box<Account<'info, PerformancePackage>>,
    
    /// CHECK: We will read the aggregator value from this account
    #[account(address = performance_package.oracle_config.oracle_account)]
    pub oracle_account: UncheckedAccount<'info>,
    
    /// The token account where locked tokens are stored
    #[account(mut)]
    pub performance_package_token_vault: Box<Account<'info, TokenAccount>>,
    
    /// The token mint - validated via has_one constraint on locker
    pub token_mint: Account<'info, Mint>,
    
    /// The recipient's ATA where tokens will be sent - created if needed
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = token_recipient
    )]
    pub recipient_token_account: Box<Account<'info, TokenAccount>>,
    
    /// CHECK: validated to match locker.token_recipient  
    #[account(address = performance_package.recipient @ PriceBasedPerformancePackageError::UnauthorizedChangeRequest)]
    pub token_recipient: UncheckedAccount<'info>,
    
    /// Payer for creating the ATA if needed
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl CompleteUnlock<'_> {
    pub fn validate(&self) -> Result<()> {
        if !matches!(self.performance_package.state, PerformancePackageState::Unlocking { .. }) {
            msg!("package state: {}", self.performance_package.state.to_string());
            return Err(PriceBasedPerformancePackageError::InvalidPerformancePackageState.into());
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let Self {
            performance_package,
            oracle_account,
            performance_package_token_vault,
            token_mint: _,
            recipient_token_account,
            token_recipient: _,
            payer: _,
            system_program: _,
            token_program,
            associated_token_program: _,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let clock = Clock::get()?;

        // Get the start values from the Unlocking state
        let (start_aggregator, start_timestamp) = match &performance_package.state {
            PerformancePackageState::Unlocking { start_aggregator, start_timestamp } => {
                (*start_aggregator, *start_timestamp)
            },
            _ => unreachable!(),
        };

        // Read the current aggregator value from the oracle account
        let oracle_data = oracle_account.try_borrow_data()?;
        let offset = performance_package.oracle_config.byte_offset as usize;
        
        // Ensure we have enough data to read 16 bytes (u128)
        require_gte!(
            oracle_data.len(),
            offset + 24,
            PriceBasedPerformancePackageError::InvalidOracleData
        );

        // Read the current aggregator value
        let current_aggregator = u128::from_le_bytes(
            oracle_data[offset..offset + 16].try_into().unwrap()
        );

        let last_updated_timestamp = i64::from_le_bytes(
            oracle_data[offset + 16..offset + 16 + 8].try_into().unwrap()
        );

        require_gte!(
            clock.unix_timestamp,
            last_updated_timestamp,
            PriceBasedPerformancePackageError::InvalidOracleData
        );

        let time_passed = last_updated_timestamp - start_timestamp;

        require_gte!(
            time_passed,
            performance_package.twap_length_seconds as i64,
            PriceBasedPerformancePackageError::TwapPeriodNotElapsed
        );

        // Calculate TWAP: (current_aggregator - start_aggregator) / time_passed
        let aggregator_change = current_aggregator.saturating_sub(start_aggregator);
        let twap_price = aggregator_change / time_passed as u128;

        let mut tokens_to_unlock = 0;

        for tranche in performance_package.tranches.iter_mut() {
            if tranche.is_unlocked {
                continue;
            }

            if twap_price >= tranche.price_threshold {
                tokens_to_unlock += tranche.token_amount;
                tranche.is_unlocked = true;
            } else {
                // tranches are sorted by price threshold, so if the price is less than the threshold, we can break
                break;
            }
        }

        // Only transfer if there are tokens to unlock
        if tokens_to_unlock > 0 {
            // Transfer tokens to recipient using PDA signature
            let seeds = &[b"performance_package", performance_package.create_key.as_ref(), &[performance_package.pda_bump]];
            let signer = &[&seeds[..]];

            let transfer_ctx = CpiContext::new_with_signer(
                token_program.to_account_info(),
                token::Transfer {
                    from: performance_package_token_vault.to_account_info(),
                    to: recipient_token_account.to_account_info(),
                    authority: performance_package.to_account_info(),
                },
                signer,
            );

            token::transfer(transfer_ctx, tokens_to_unlock)?;

            performance_package.already_unlocked_amount += tokens_to_unlock;
        }

        require_gte!(performance_package.total_token_amount, performance_package.already_unlocked_amount, PriceBasedPerformancePackageError::InvariantViolated);

        // Reset locker state back to Locked for next unlock cycle
        performance_package.state = PerformancePackageState::Locked;
        performance_package.seq_num += 1;

        emit_cpi!(UnlockCompleted {
            common: CommonFields::new(&clock, performance_package.seq_num),
            performance_package: performance_package.key(),
            token_amount: tokens_to_unlock,
            recipient: performance_package.recipient,
            twap_price,
        });

        Ok(())
    }
}
