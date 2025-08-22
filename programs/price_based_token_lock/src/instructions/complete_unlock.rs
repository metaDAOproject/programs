use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

use super::*;

#[derive(Accounts)]
pub struct CompleteUnlock<'info> {
    #[account(
        mut,
        seeds = [b"locker", locker_authority.key().as_ref()],
        bump,
    )]
    pub locker: Box<Account<'info, Locker>>,
    
    /// The authority of the locker
    /// CHECK: This is used to derive the PDA
    pub locker_authority: UncheckedAccount<'info>,
    
    /// The oracle account that provides price data
    /// CHECK: We will read the aggregator value from this account
    pub oracle_account: UncheckedAccount<'info>,
    
    /// The token account where locked tokens are stored
    #[account(mut)]
    pub locker_token_account: Box<Account<'info, TokenAccount>>,
    
    /// The recipient's token account where tokens will be sent
    #[account(mut)]
    pub recipient_token_account: Box<Account<'info, TokenAccount>>,
    

    
    pub clock: Sysvar<'info, Clock>,
    pub token_program: Program<'info, Token>,
}

impl CompleteUnlock<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let locker = &mut ctx.accounts.locker;
        let clock = &ctx.accounts.clock;

        // Verify that the locker is in the Unlocking state
        let (start_aggregator, start_timestamp) = match &locker.state {
            LockerState::Unlocking { start_aggregator, start_timestamp } => {
                (*start_aggregator, *start_timestamp)
            },
            _ => return err!(PriceBasedTokenLockError::InvalidLockerState),
        };

        // Calculate how much time has passed since unlocking started
        let time_passed = clock.unix_timestamp - start_timestamp;
        require!(
            time_passed >= locker.twap_length_seconds as i64,
            PriceBasedTokenLockError::TwapCalculationFailed
        );

        // Read the current aggregator value from the oracle account
        let oracle_data = ctx.accounts.oracle_account.try_borrow_data()?;
        let offset = locker.aggregator_byte_offset as usize;
        
        // Ensure we have enough data to read 16 bytes (u128)
        require!(
            offset + 16 <= oracle_data.len(),
            PriceBasedTokenLockError::InvalidOracleData
        );

        // Read the current aggregator value
        let current_aggregator = u128::from_le_bytes(
            oracle_data[offset..offset + 16].try_into().unwrap()
        );

        // Calculate TWAP: (current_aggregator - start_aggregator) / time_passed
        let aggregator_change = current_aggregator.saturating_sub(start_aggregator);
        let twap_price = aggregator_change / time_passed as u128;

        // Check if the TWAP price meets the threshold
        require!(
            twap_price >= locker.price_threshold,
            PriceBasedTokenLockError::PriceThresholdNotMet
        );

        // Transfer tokens to recipient using PDA signature
        let authority_key = ctx.accounts.locker_authority.key();
        let seeds = &[b"locker", authority_key.as_ref(), &[ctx.bumps.locker]];
        let signer = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.locker_token_account.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.locker_authority.to_account_info(),
            },
            signer,
        );

        token::transfer(transfer_ctx, locker.token_amount)?;

        // Update locker state to Unlocked
        locker.state = LockerState::Unlocked;

        // Emit event
        emit!(UnlockCompleted {
            locker: locker.key(),
            token_amount: locker.token_amount,
            recipient: locker.token_recipient,
            twap_price,
            price_threshold: locker.price_threshold,
        });

        Ok(())
    }
}
