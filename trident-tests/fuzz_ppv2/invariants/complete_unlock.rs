#![allow(clippy::too_many_arguments)]

use crate::common::types::performance_package_v_2::OracleReader;
use crate::common::types::performance_package_v_2::PackageStatus;
use crate::common::types::performance_package_v_2::PerformancePackage;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

impl FuzzTest {
    pub fn verify_complete_unlock_invariants(
        &mut self,
        performance_package: Pubkey,
        mint_governor: Pubkey,
        mint_authority: Pubkey,
        token_mint: Pubkey,
        recipient_token_account: Pubkey,
        signer: Pubkey,
        pre_pp: &PerformancePackage,
        pre_recipient_amount: u64,
        timestamp_before_tx: i64,
    ) {
        let post_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist after CompleteUnlock");
        let post_recipient = self
            .trident
            .get_token_account(recipient_token_account)
            .expect("Recipient token account must exist after CompleteUnlock")
            .account;

        // Invariant 1: signer must be authority or recipient, and the passed accounts must match
        // the identities stored on the performance package.
        assert!(
            signer == pre_pp.authority || signer == pre_pp.recipient,
            "CompleteUnlock signer must be authority or recipient"
        );
        assert_eq!(
            mint_governor, pre_pp.mintGovernor,
            "Passed mint_governor must match PerformancePackage.mintGovernor"
        );
        assert_eq!(
            mint_authority, pre_pp.mintAuthority,
            "Passed mint_authority must match PerformancePackage.mintAuthority"
        );
        assert_eq!(
            token_mint, pre_pp.mint,
            "Passed token_mint must match PerformancePackage.mint"
        );
        assert_eq!(
            post_recipient.mint, token_mint,
            "Recipient ATA mint must match token_mint"
        );
        assert_eq!(
            post_recipient.owner, pre_pp.recipient,
            "Recipient ATA owner must match PerformancePackage.recipient"
        );

        // Invariant 2: pre-state must be Unlocking, and CompleteUnlock must transition back to
        // Locked while incrementing seqNum by exactly 1.
        assert!(
            matches!(pre_pp.status, PackageStatus::Unlocking),
            "Pre-state must be Unlocking if CompleteUnlock succeeded"
        );
        assert!(
            matches!(post_pp.status, PackageStatus::Locked),
            "Post-state must be Locked after CompleteUnlock"
        );
        assert_eq!(
            post_pp.seqNum,
            pre_pp
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "seqNum must increment by exactly 1 on CompleteUnlock"
        );

        // Invariant 3: totalRewardsPaidOut must be monotonic and exactly track the amount minted
        // to the recipient during this instruction.
        assert!(
            post_pp.totalRewardsPaidOut >= pre_pp.totalRewardsPaidOut,
            "totalRewardsPaidOut must not decrease on CompleteUnlock"
        );
        let paid_out_delta = post_pp
            .totalRewardsPaidOut
            .checked_sub(pre_pp.totalRewardsPaidOut)
            .expect("totalRewardsPaidOut must not decrease");
        let recipient_delta = post_recipient
            .amount
            .checked_sub(pre_recipient_amount)
            .expect("Recipient token account amount must not decrease");
        assert_eq!(
            recipient_delta, paid_out_delta,
            "Recipient ATA increase must equal the increase in totalRewardsPaidOut"
        );

        // Invariant 4: oracle_reader must be reset for the next unlock cycle.
        match (&pre_pp.oracleReader, &post_pp.oracleReader) {
            (OracleReader::Time, OracleReader::Time) => {}
            (
                OracleReader::FutarchyTwap {
                    amm: pre_amm,
                    minDuration: pre_min_duration,
                    ..
                },
                OracleReader::FutarchyTwap {
                    amm: post_amm,
                    minDuration: post_min_duration,
                    startValue: post_start_value,
                    startTime: post_start_time,
                    endValue: post_end_value,
                    endTime: post_end_time,
                },
            ) => {
                assert_eq!(
                    post_amm, pre_amm,
                    "FutarchyTwap amm must not change on CompleteUnlock"
                );
                assert_eq!(
                    post_min_duration, pre_min_duration,
                    "FutarchyTwap minDuration must not change on CompleteUnlock"
                );
                assert_eq!(
                    *post_start_value, 0,
                    "FutarchyTwap startValue must be reset to 0 after CompleteUnlock"
                );
                assert_eq!(
                    *post_start_time, 0,
                    "FutarchyTwap startTime must be reset to 0 after CompleteUnlock"
                );
                assert_eq!(
                    *post_end_value, 0,
                    "FutarchyTwap endValue must be reset to 0 after CompleteUnlock"
                );
                assert_eq!(
                    *post_end_time, 0,
                    "FutarchyTwap endTime must be reset to 0 after CompleteUnlock"
                );
            }
            _ => panic!("oracleReader variant must not change on CompleteUnlock"),
        }

        // Invariant 5: CompleteUnlock must not mutate unrelated fields.
        assert_eq!(
            post_pp.mint, pre_pp.mint,
            "mint must not change on CompleteUnlock"
        );
        assert_eq!(
            post_pp.mintGovernor, pre_pp.mintGovernor,
            "mintGovernor must not change on CompleteUnlock"
        );
        assert_eq!(
            post_pp.mintAuthority, pre_pp.mintAuthority,
            "mintAuthority must not change on CompleteUnlock"
        );
        assert_eq!(
            post_pp.authority, pre_pp.authority,
            "authority must not change on CompleteUnlock"
        );
        assert_eq!(
            post_pp.recipient, pre_pp.recipient,
            "recipient must not change on CompleteUnlock"
        );
        assert_eq!(
            post_pp.rewardFunction, pre_pp.rewardFunction,
            "rewardFunction must not change on CompleteUnlock"
        );
        assert_eq!(
            post_pp.minUnlockTimestamp, pre_pp.minUnlockTimestamp,
            "minUnlockTimestamp must not change on CompleteUnlock"
        );
        assert_eq!(
            post_pp.createKey, pre_pp.createKey,
            "createKey must not change on CompleteUnlock"
        );
        assert_eq!(
            post_pp.bump, pre_pp.bump,
            "bump must not change on CompleteUnlock"
        );

        // Invariant 6: successful completion must observe non-decreasing time.
        let timestamp_after_tx = self.trident.get_current_timestamp();
        assert!(
            timestamp_before_tx <= timestamp_after_tx,
            "Timestamp must not go backwards across CompleteUnlock"
        );
    }
}
