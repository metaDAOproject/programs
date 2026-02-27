use anchor_lang::prelude::*;

use crate::{
    CommonFields, PackageStatus, PerformancePackage, PerformancePackageError, UnlockStartedEvent,
    PERFORMANCE_PACKAGE_SEED,
};

#[event_cpi]
#[derive(Accounts)]
pub struct StartUnlock<'info> {
    #[account(
        mut,
        seeds = [PERFORMANCE_PACKAGE_SEED, performance_package.create_key.as_ref()],
        bump = performance_package.bump
    )]
    pub performance_package: Account<'info, PerformancePackage>,

    pub signer: Signer<'info>,
}

impl StartUnlock<'_> {
    pub fn validate(&self) -> Result<()> {
        let pp = &self.performance_package;

        // Only the recipient can start an unlock
        require_keys_eq!(
            self.signer.key(),
            pp.recipient,
            PerformancePackageError::Unauthorized
        );

        // Must be in Locked status
        require!(
            pp.status == PackageStatus::Locked,
            PerformancePackageError::NotLocked
        );

        // min_unlock_timestamp must have been reached
        let clock = Clock::get()?;
        require_gte!(
            clock.unix_timestamp,
            pp.min_unlock_timestamp,
            PerformancePackageError::UnlockTimestampNotReached
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let pp = &mut ctx.accounts.performance_package;

        // Record start snapshot (no-op for Time oracle, reads AMM for FutarchyTwap)
        pp.oracle_reader.record_start(ctx.remaining_accounts)?;

        // Transition to Unlocking status
        pp.status = PackageStatus::Unlocking;

        // Increment sequence number
        pp.seq_num += 1;

        let clock = Clock::get()?;

        emit_cpi!(UnlockStartedEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
                performance_package_seq_num: pp.seq_num,
            },
            performance_package: pp.key(),
            start_time: clock.unix_timestamp,
        });

        Ok(())
    }
}
