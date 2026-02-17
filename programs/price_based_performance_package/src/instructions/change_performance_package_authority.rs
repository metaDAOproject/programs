use crate::{
    CommonFields, PerformancePackage, PerformancePackageAuthorityChanged,
    PriceBasedPerformancePackageError,
};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ChangePerformancePackageAuthorityParams {
    pub new_performance_package_authority: Pubkey,
}

#[event_cpi]
#[derive(Accounts)]
pub struct ChangePerformancePackageAuthority<'info> {
    #[account(mut)]
    pub performance_package: Account<'info, PerformancePackage>,

    #[account(address = performance_package.performance_package_authority @ PriceBasedPerformancePackageError::UnauthorizedLockerAuthority)]
    pub current_authority: Signer<'info>,
}

impl<'info> ChangePerformancePackageAuthority<'info> {
    pub fn handle(
        ctx: Context<Self>,
        params: ChangePerformancePackageAuthorityParams,
    ) -> Result<()> {
        let Self {
            performance_package,
            current_authority: _,
            ..
        } = ctx.accounts;

        let ChangePerformancePackageAuthorityParams {
            new_performance_package_authority: new_locker_authority,
        } = params;

        let clock = Clock::get()?;
        let old_authority = performance_package.performance_package_authority;

        // Update the locker authority
        performance_package.performance_package_authority = new_locker_authority;

        performance_package.seq_num += 1;

        // Emit event
        emit_cpi!(PerformancePackageAuthorityChanged {
            common: CommonFields::new(&clock, performance_package.seq_num),
            locker: performance_package.key(),
            old_authority,
            new_authority: new_locker_authority,
        });

        Ok(())
    }
}
