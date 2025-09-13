use anchor_lang::prelude::*;

use super::*;

#[derive(Accounts)]
#[event_cpi]
pub struct StartUnlock<'info> {
    #[account(mut)]
    pub locker: Account<'info, Locker>,
    
    /// CHECK: We will read the aggregator value from this account
    #[account(address = locker.oracle_config.oracle_account)]
    pub oracle_account: UncheckedAccount<'info>,
    
    /// Only the token recipient can start unlock
    pub recipient: Signer<'info>,
}

impl StartUnlock<'_> {
    pub fn validate(&self) -> Result<()> {
        // Verify that the signer is the token recipient
        if self.recipient.key() != self.locker.token_recipient {
            return Err(PriceBasedUnlockError::UnauthorizedChangeRequest.into());
        }

        // Verify that the locker is in the Locked state
        if !matches!(self.locker.state, LockerState::Locked) {
            return Err(PriceBasedUnlockError::InvalidLockerState.into());
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let Self {
            locker,
            oracle_account: _,
            recipient: _,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let clock = Clock::get()?;

        // Verify that the current time is past the unlock timestamp
        require!(
            clock.unix_timestamp >= locker.unlock_timestamp,
            PriceBasedUnlockError::UnlockTimestampNotReached
        );

        // Read the current aggregator value from the oracle account
        let oracle_data = ctx.accounts.oracle_account.try_borrow_data()?;
        let offset = locker.oracle_config.byte_offset as usize;
        
        // Ensure we have enough data to read 24 bytes (16 bytes for aggregator, 8 bytes for last updated slot)
        require_gte!(
            oracle_data.len(),
            offset + 16 + 8,
            PriceBasedUnlockError::InvalidOracleData
        );

        // Read the aggregator value (assuming it's stored as u128)
        let start_aggregator = u128::from_le_bytes(
            oracle_data[offset..offset + 16].try_into().unwrap()
        );

        let last_updated_timestamp = i64::from_le_bytes(
            oracle_data[offset + 16..offset + 16 + 8].try_into().unwrap()
        );

        // The last updated timestamp should be greater than or equal to the unlock timestamp
        // and less than or equal to the current time
        require_gte!(last_updated_timestamp, locker.unlock_timestamp, PriceBasedUnlockError::InvalidOracleData);
        require_gte!(clock.unix_timestamp, last_updated_timestamp, PriceBasedUnlockError::InvalidOracleData);

        locker.state = LockerState::Unlocking {
            start_aggregator,
            // We use the last updated timestamp to keep the aggregator and timestamp in sync
            start_timestamp: last_updated_timestamp,
        };

        emit_cpi!(UnlockStarted {
            locker: locker.key(),
            start_aggregator,
            start_timestamp: last_updated_timestamp,
        });

        Ok(())
    }
}
