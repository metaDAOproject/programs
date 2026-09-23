use anchor_lang::prelude::*;

use super::*;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct InitializePerformancePackageWithLimitsParams {
    pub base: InitializePerformancePackageParams,
    pub limits: Option<LimitsParams>,
}

impl InitializePerformancePackage<'_> {
    pub fn validate_with_limits(
        &self,
        params: &InitializePerformancePackageWithLimitsParams,
    ) -> Result<()> {
        self.validate(&params.base)?;

        if let Some(limits) = &params.limits {
            limits.validate(Clock::get()?.unix_timestamp)?;
        }

        Ok(())
    }

    pub fn handle_with_limits(
        ctx: Context<Self>,
        params: InitializePerformancePackageWithLimitsParams,
    ) -> Result<()> {
        Self::handle_inner(ctx, params.base, params.limits)
    }
}
