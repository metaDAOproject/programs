use anchor_lang::prelude::*;

use crate::{
    CommonFields, PackageStatus, PerformancePackage, PerformancePackageClosedEvent,
    PerformancePackageError, PERFORMANCE_PACKAGE_SEED,
};

pub mod admin {
    use anchor_lang::prelude::declare_id;

    // MetaDAO operational multisig
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

#[event_cpi]
#[derive(Accounts)]
pub struct ClosePerformancePackage<'info> {
    #[account(
        mut,
        seeds = [PERFORMANCE_PACKAGE_SEED, performance_package.create_key.as_ref()],
        bump = performance_package.bump,
        close = rent_destination
    )]
    pub performance_package: Account<'info, PerformancePackage>,

    pub admin: Signer<'info>,

    /// CHECK: Receives closed account rent
    #[account(mut)]
    pub rent_destination: UncheckedAccount<'info>,
}

impl ClosePerformancePackage<'_> {
    pub fn validate(&self) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(
            self.admin.key(),
            admin::ID,
            PerformancePackageError::InvalidAdmin
        );

        // Status must be Locked (cannot close while unlocking)
        require!(
            self.performance_package.status == PackageStatus::Locked,
            PerformancePackageError::NotLocked
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let pp = &mut ctx.accounts.performance_package;
        let clock = Clock::get()?;

        pp.seq_num += 1;

        emit_cpi!(PerformancePackageClosedEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
                performance_package_seq_num: pp.seq_num,
            },
            performance_package: pp.key(),
            total_rewards_paid_out: pp.total_rewards_paid_out,
            pp_created_at_timestamp: pp.created_at_timestamp,
        });

        // The performance_package account is closed automatically via the `close = rent_destination` constraint

        Ok(())
    }
}
