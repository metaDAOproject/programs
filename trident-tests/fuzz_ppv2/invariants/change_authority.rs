use crate::common::types::performance_package_v_2::PerformancePackage;
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;

impl FuzzTest {
    pub fn verify_change_authority_invariants(
        &mut self,
        performance_package: Pubkey,
        current_authority: Pubkey,
        new_authority: Pubkey,
        pre_pp: &PerformancePackage,
    ) {
        let post_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist after ChangeAuthority");

        // Invariant 1: the signer passed as `current_authority` must equal the authority that was
        // stored before the instruction executed (otherwise the instruction should not succeed).
        assert_eq!(
            current_authority, pre_pp.authority,
            "current_authority must match the pre-state authority"
        );

        // Invariant 2: `authority` must be updated exactly to the new authority account.
        assert_eq!(
            post_pp.authority, new_authority,
            "authority must be updated to the new_authority account"
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
        assert_eq!(
            post_pp.bump, pre_pp.bump,
            "bump must not change"
        );
        assert_eq!(
            post_pp.mint, pre_pp.mint,
            "mint must not change"
        );
        assert_eq!(
            post_pp.mintGovernor, pre_pp.mintGovernor,
            "mintGovernor must not change"
        );
        assert_eq!(
            post_pp.mintAuthority, pre_pp.mintAuthority,
            "mintAuthority must not change"
        );
        assert_eq!(
            post_pp.recipient, pre_pp.recipient,
            "recipient must not change"
        );
        assert_eq!(
            post_pp.oracleReader, pre_pp.oracleReader,
            "oracleReader must not change"
        );
        assert_eq!(
            post_pp.rewardFunction, pre_pp.rewardFunction,
            "rewardFunction must not change"
        );
        assert_eq!(
            post_pp.status, pre_pp.status,
            "status must not change"
        );
        assert_eq!(
            post_pp.minUnlockTimestamp, pre_pp.minUnlockTimestamp,
            "minUnlockTimestamp must not change"
        );
        assert_eq!(
            post_pp.totalRewardsPaidOut, pre_pp.totalRewardsPaidOut,
            "totalRewardsPaidOut must not change"
        );
    }
}
