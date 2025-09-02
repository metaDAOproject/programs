use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

use super::*;

#[derive(Accounts)]
#[event_cpi]
pub struct CompleteUnlock<'info> {
    #[account(mut)]
    pub locker: Box<Account<'info, Locker>>,
    
    /// CHECK: We will read the aggregator value from this account
    #[account(address = locker.oracle_config.oracle_account)]
    pub oracle_account: UncheckedAccount<'info>,
    
    /// The token account where locked tokens are stored
    #[account(mut)]
    pub locker_token_account: Box<Account<'info, TokenAccount>>,
    
    /// The recipient's token account where tokens will be sent
    #[account(mut)]
    pub recipient_token_account: Box<Account<'info, TokenAccount>>,
    
    pub token_program: Program<'info, Token>,
}

impl CompleteUnlock<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let locker = &mut ctx.accounts.locker;
        let clock = Clock::get()?;

        // Verify that the locker is in the Unlocking state
        let (start_aggregator, start_timestamp) = match &locker.state {
            LockerState::Unlocking { start_aggregator, start_timestamp } => {
                (*start_aggregator, *start_timestamp)
            },
            _ => return err!(PriceBasedUnlockError::InvalidLockerState),
        };

        // Read the current aggregator value from the oracle account
        let oracle_data = ctx.accounts.oracle_account.try_borrow_data()?;
        let offset = locker.oracle_config.byte_offset as usize;
        
        // Ensure we have enough data to read 16 bytes (u128)
        require!(
            offset + 24 <= oracle_data.len(),
            PriceBasedUnlockError::InvalidOracleData
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
            PriceBasedUnlockError::InvalidOracleData
        );

        let time_passed = last_updated_timestamp - start_timestamp;

        require_gte!(
            time_passed,
            locker.twap_length_seconds as i64,
            PriceBasedUnlockError::TwapCalculationFailed
        );

        // Calculate TWAP: (current_aggregator - start_aggregator) / time_passed
        let aggregator_change = current_aggregator.saturating_sub(start_aggregator);
        let twap_price = aggregator_change / time_passed as u128;

        // Check if the TWAP price meets the threshold
        require_gte!(
            twap_price,
            locker.price_threshold,
            PriceBasedUnlockError::PriceThresholdNotMet
        );

        // Transfer tokens to recipient using PDA signature
        let seeds = &[b"locker", locker.create_key.as_ref(), &[locker.pda_bump]];
        let signer = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.locker_token_account.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: locker.to_account_info(),
            },
            signer,
        );

        token::transfer(transfer_ctx, locker.token_amount)?;

        // Update locker state to Unlocked
        locker.state = LockerState::Unlocked;

        emit_cpi!(UnlockCompleted {
            locker: locker.key(),
            token_amount: locker.token_amount,
            recipient: locker.token_recipient,
            twap_price,
            price_threshold: locker.price_threshold,
        });

        Ok(())
    }
}
