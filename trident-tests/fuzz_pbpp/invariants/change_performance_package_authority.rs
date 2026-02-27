use crate::common::types::price_based_performance_package::ChangePerformancePackageAuthorityParams;
use crate::common::types::price_based_performance_package::PerformancePackage;
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;

impl FuzzTest {
    pub fn verify_change_performance_package_authority_invariants(
        &mut self,
        performance_package: Pubkey,
        current_authority: Pubkey,
        args: &ChangePerformancePackageAuthorityParams,
        pre_pp: &PerformancePackage,
    ) {
        let post_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist after ChangePerformancePackageAuthority");

        // Invariant 1: the signer passed as `current_authority` must equal the authority that was
        // stored before the instruction executed (otherwise the instruction should not succeed).
        assert_eq!(
            current_authority, pre_pp.performancePackageAuthority,
            "current_authority must match the pre-state performancePackageAuthority"
        );

        // Invariant 2: `performancePackageAuthority` must be updated exactly to the new authority
        // provided in args.
        assert_eq!(
            post_pp.performancePackageAuthority, args.newPerformancePackageAuthority,
            "performancePackageAuthority must be updated to args.newPerformancePackageAuthority"
        );

        // Invariant 3: `seqNum` must increment by exactly 1.
        assert_eq!(
            post_pp.seqNum,
            pre_pp
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "seqNum must increment by exactly 1"
        );

        // Invariant 4: no other fields should change as a result of changing authority.
        assert_eq!(
            post_pp.createKey, pre_pp.createKey,
            "createKey must not change"
        );
        assert_eq!(post_pp.pdaBump, pre_pp.pdaBump, "pdaBump must not change");
        assert_eq!(
            post_pp.tokenMint, pre_pp.tokenMint,
            "tokenMint must not change"
        );
        assert_eq!(
            post_pp.performancePackageTokenVault, pre_pp.performancePackageTokenVault,
            "performancePackageTokenVault must not change"
        );
        assert_eq!(
            post_pp.recipient, pre_pp.recipient,
            "recipient must not change"
        );
        assert_eq!(
            post_pp.minUnlockTimestamp, pre_pp.minUnlockTimestamp,
            "minUnlockTimestamp must not change"
        );
        assert_eq!(
            post_pp.oracleConfig.oracleAccount, pre_pp.oracleConfig.oracleAccount,
            "oracleConfig.oracleAccount must not change"
        );
        assert_eq!(
            post_pp.oracleConfig.byteOffset, pre_pp.oracleConfig.byteOffset,
            "oracleConfig.byteOffset must not change"
        );
        assert_eq!(
            post_pp.twapLengthSeconds, pre_pp.twapLengthSeconds,
            "twapLengthSeconds must not change"
        );
        assert_eq!(
            post_pp.totalTokenAmount, pre_pp.totalTokenAmount,
            "totalTokenAmount must not change"
        );
        assert_eq!(
            post_pp.alreadyUnlockedAmount, pre_pp.alreadyUnlockedAmount,
            "alreadyUnlockedAmount must not change"
        );
        assert_eq!(
            post_pp.tranches.len(),
            pre_pp.tranches.len(),
            "tranches length must not change"
        );
    }
}
