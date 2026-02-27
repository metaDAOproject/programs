use crate::common::types::price_based_performance_package::PerformancePackage;
use crate::common::types::price_based_performance_package::PerformancePackageState;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

impl FuzzTest {
    pub fn verify_start_unlock_invariants(
        &mut self,
        performance_package: Pubkey,
        oracle_account: Pubkey,
        recipient: Pubkey,
        pre_pp: &PerformancePackage,
        pre_vault_amount: u64,
    ) {
        let post_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist after StartUnlock");

        // Read oracle data
        let oracle_acc = self.trident.get_account(&oracle_account);
        let oracle_data = oracle_acc.data();
        let offset = pre_pp.oracleConfig.byteOffset as usize;

        // Invariant 1: `recipient` must match the pre-state recipient (has_one constraint).
        assert_eq!(
            recipient, pre_pp.recipient,
            "StartUnlock recipient signer must equal PerformancePackage.recipient"
        );

        // Invariant 2: StartUnlock must transition state from Locked -> Unlocking with
        // {start_aggregator, start_timestamp} matching oracle bytes at configured offset.
        assert!(
            matches!(pre_pp.state, PerformancePackageState::Locked),
            "Pre-state must be Locked if tx succeeded"
        );
        assert!(
            oracle_data.len() >= offset + 24,
            "Oracle account must have at least offset+24 bytes"
        );

        let expected_start_aggregator =
            u128::from_le_bytes(oracle_data[offset..offset + 16].try_into().unwrap());
        let expected_last_updated_timestamp =
            i64::from_le_bytes(oracle_data[offset + 16..offset + 24].try_into().unwrap());

        match &post_pp.state {
            PerformancePackageState::Unlocking {
                startAggregator,
                startTimestamp,
            } => {
                assert_eq!(
                    *startAggregator, expected_start_aggregator,
                    "Unlocking.startAggregator must equal oracle aggregator"
                );
                assert_eq!(
                    *startTimestamp, expected_last_updated_timestamp,
                    "Unlocking.startTimestamp must equal oracle last_updated_timestamp"
                );
            }
            _ => panic!("Post-state must be Unlocking after StartUnlock"),
        }

        // Invariant 3: seqNum must increment by exactly 1.
        assert_eq!(
            post_pp.seqNum,
            pre_pp
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "seqNum must increment by exactly 1 on StartUnlock"
        );

        // Invariant 4: start timestamp must be within [minUnlockTimestamp, now] and unlock must be allowed.
        let timestamp_after_tx = self.trident.get_current_timestamp();
        assert!(
            timestamp_after_tx >= pre_pp.minUnlockTimestamp,
            "Clock must be >= minUnlockTimestamp if StartUnlock succeeded"
        );
        assert!(
            expected_last_updated_timestamp >= pre_pp.minUnlockTimestamp,
            "Oracle last_updated_timestamp must be >= minUnlockTimestamp if StartUnlock succeeded"
        );
        assert!(
            expected_last_updated_timestamp <= timestamp_after_tx,
            "Oracle last_updated_timestamp must be <= current time if StartUnlock succeeded"
        );

        // Invariant 5: StartUnlock must not move tokens or mutate unrelated fields.
        let post_vault_amount = self
            .trident
            .get_token_account(pre_pp.performancePackageTokenVault)
            .expect("Vault must exist")
            .account
            .amount;
        assert_eq!(
            post_vault_amount, pre_vault_amount,
            "Vault token amount must not change on StartUnlock"
        );

        assert_eq!(
            post_pp.recipient, pre_pp.recipient,
            "recipient must not change"
        );
        assert_eq!(
            post_pp.performancePackageAuthority, pre_pp.performancePackageAuthority,
            "performancePackageAuthority must not change"
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
            "alreadyUnlockedAmount must not change on StartUnlock"
        );
    }
}
