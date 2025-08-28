use anchor_lang::prelude::*;

use super::*;

#[derive(Accounts)]
pub struct StartUnlock<'info> {
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
    
    pub clock: Sysvar<'info, Clock>,
}

impl StartUnlock<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let locker = &mut ctx.accounts.locker;
        let clock = &ctx.accounts.clock;

        // Verify that the current time is past the unlock timestamp
        require!(
            clock.unix_timestamp >= locker.unlock_timestamp,
            PriceBasedTokenLockError::UnlockTimestampNotReached
        );

        // Verify that the locker is in the Locked state
        require!(
            matches!(locker.state, LockerState::Locked),
            PriceBasedTokenLockError::InvalidLockerState
        );

        // Read the current aggregator value from the oracle account
        let oracle_data = ctx.accounts.oracle_account.try_borrow_data()?;
        let offset = locker.aggregator_byte_offset as usize;
        
        // Ensure we have enough data to read 16 bytes (u128)
        require!(
            offset + 16 <= oracle_data.len(),
            PriceBasedTokenLockError::InvalidOracleData
        );

        // Read the aggregator value (assuming it's stored as u128)
        let start_aggregator = u128::from_le_bytes(
            oracle_data[offset..offset + 16].try_into().unwrap()
        );

        // Update locker state to Unlocking
        locker.state = LockerState::Unlocking {
            start_aggregator,
            start_timestamp: clock.unix_timestamp,
        };

        // Emit event
        emit!(UnlockStarted {
            locker: locker.key(),
            start_aggregator,
            start_timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}
