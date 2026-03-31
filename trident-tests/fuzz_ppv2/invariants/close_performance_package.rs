use crate::common::types::performance_package_v_2::PackageStatus;
use crate::common::types::performance_package_v_2::PerformancePackage;
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;

use trident_fuzz::invariant;

impl FuzzTest {
    pub fn verify_close_performance_package_invariants(
        &mut self,
        performance_package: Pubkey,
        pre_pp: &PerformancePackage,
    ) {
        // Invariant 1: close is only allowed from the Locked state.
        invariant!(
            matches!(pre_pp.status, PackageStatus::Locked),
            "Pre-state must be Locked if ClosePerformancePackage succeeded"
        );

        // Invariant 2: the performance_package account must be closed after the instruction.
        let post_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8));
        invariant!(
            post_pp.is_none(),
            "PerformancePackage must be closed (not readable) after ClosePerformancePackage"
        );
    }
}
