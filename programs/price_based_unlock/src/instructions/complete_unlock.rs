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

        // Calculate linear unlock percentage: current_price / price_threshold * 100
        // Cap at 100% if price exceeds threshold
        let unlock_percentage = if twap_price >= locker.price_threshold {
            100u128
        } else {
            (twap_price * 100) / locker.price_threshold
        };

        // Calculate total tokens that should be unlocked based on current price
        let total_unlockable = (locker.token_amount as u128 * unlock_percentage / 100) as u64;

        // Calculate tokens to unlock this time = total_unlockable - already_unlocked
        // If price decreased and total_unlockable < already_unlocked, no additional tokens to unlock
        let tokens_to_unlock = if total_unlockable > locker.tokens_already_unlocked {
            total_unlockable - locker.tokens_already_unlocked
        } else {
            0
        };

        // Only transfer if there are tokens to unlock
        if tokens_to_unlock > 0 {
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

            token::transfer(transfer_ctx, tokens_to_unlock)?;

            // Update tokens already unlocked
            locker.tokens_already_unlocked = total_unlockable;

            // Emit tokens claimed event
            emit_cpi!(TokensClaimed {
                locker: locker.key(),
                recipient: locker.token_recipient,
                tokens_claimed: tokens_to_unlock,
                tokens_already_unlocked: locker.tokens_already_unlocked,
                total_token_amount: locker.token_amount,
                current_price: twap_price,
                unlock_percentage,
            });
        }

        // Only set to Unlocked if all tokens have been unlocked
        if locker.tokens_already_unlocked >= locker.token_amount {
            locker.state = LockerState::Unlocked;
        }
        // Otherwise stay in Unlocking state for future unlock calls

        emit_cpi!(UnlockCompleted {
            locker: locker.key(),
            token_amount: tokens_to_unlock,
            recipient: locker.token_recipient,
            twap_price,
            price_threshold: locker.price_threshold,
        });

        Ok(())
    }
}
