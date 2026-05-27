use anchor_lang::prelude::*;

use crate::{
    AuthorityChangedEvent, CommonFields, PerformancePackage, PerformancePackageError,
    PERFORMANCE_PACKAGE_SEED,
};

#[event_cpi]
#[derive(Accounts)]
pub struct ChangeAuthority<'info> {
    #[account(
        mut,
        seeds = [PERFORMANCE_PACKAGE_SEED, performance_package.create_key.as_ref()],
        bump = performance_package.bump,
        has_one = authority @ PerformancePackageError::InvalidAuthority
    )]
    pub performance_package: Account<'info, PerformancePackage>,

    /// Must be the current authority of the performance package
    pub authority: Signer<'info>,

    /// The new authority address
    /// CHECK: Can be any valid pubkey
    pub new_authority: UncheckedAccount<'info>,
}

impl ChangeAuthority<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let pp = &mut ctx.accounts.performance_package;

        let new_authority = ctx.accounts.new_authority.key();

        // Update authority
        pp.authority = new_authority;

        // Increment sequence number
        pp.seq_num += 1;

        let clock = Clock::get()?;

        emit_cpi!(AuthorityChangedEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
                performance_package_seq_num: pp.seq_num,
            },
            performance_package: pp.key(),
            old_authority: ctx.accounts.authority.key(),
            new_authority,
            pp_created_at_timestamp: pp.created_at_timestamp,
        });

        Ok(())
    }
}
