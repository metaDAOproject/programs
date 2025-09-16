use anchor_lang::prelude::*;

use super::*;

#[derive(Accounts)]
#[event_cpi]
pub struct StartUnlock<'info> {
    #[account(mut, has_one = recipient)]
    pub performance_package: Account<'info, PerformancePackage>,
    
    /// CHECK: We will read the aggregator value from this account
    #[account(address = performance_package.oracle_config.oracle_account)]
    pub oracle_account: UncheckedAccount<'info>,
    
    /// Only the token recipient can start unlock
    pub recipient: Signer<'info>,
}

impl StartUnlock<'_> {
    pub fn validate(&self) -> Result<()> {
        require_eq!(self.performance_package.state, PerformancePackageState::Locked, PriceBasedPerformancePackageError::InvalidPerformancePackageState);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let Self {
            performance_package,
            oracle_account: _,
            recipient: _,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let clock = Clock::get()?;

        // Verify that the current time is past the unlock timestamp
        require_gte!(
            clock.unix_timestamp,
            performance_package.unlock_timestamp,
            PriceBasedPerformancePackageError::UnlockTimestampNotReached
        );

        // Read the current aggregator value from the oracle account
        let oracle_data = ctx.accounts.oracle_account.try_borrow_data()?;
        let offset = performance_package.oracle_config.byte_offset as usize;
        
        // Ensure we have enough data to read 24 bytes (16 bytes for aggregator, 8 bytes for last updated slot)
        require_gte!(
            oracle_data.len(),
            offset + 16 + 8,
            PriceBasedPerformancePackageError::InvalidOracleData
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
        require_gte!(last_updated_timestamp, performance_package.unlock_timestamp, PriceBasedPerformancePackageError::InvalidOracleData);
        require_gte!(clock.unix_timestamp, last_updated_timestamp, PriceBasedPerformancePackageError::InvalidOracleData);

        performance_package.state = PerformancePackageState::Unlocking {
            start_aggregator,
            // We use the last updated timestamp to keep the aggregator and timestamp in sync
            start_timestamp: last_updated_timestamp,
        };

        performance_package.seq_num += 1;

        emit_cpi!(UnlockStarted {
            common: CommonFields::new(&clock, performance_package.seq_num),
            performance_package: performance_package.key(),
            start_aggregator,
            start_timestamp: last_updated_timestamp,
        });

        Ok(())
    }
}
