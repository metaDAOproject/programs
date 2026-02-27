#![allow(clippy::too_many_arguments)]

use crate::common::types::price_based_performance_package::PerformancePackage;
use crate::common::types::price_based_performance_package::PerformancePackageState;
use crate::FuzzTest;
use trident_fuzz::fuzzing::*;

impl FuzzTest {
    pub fn verify_complete_unlock_invariants(
        &mut self,
        performance_package: Pubkey,
        oracle_account: Pubkey,
        performance_package_token_vault: Pubkey,
        token_mint: Pubkey,
        recipient_token_account: Pubkey,
        recipient: Pubkey,
        pre_pp: &PerformancePackage,
        pre_vault_amount: u64,
        pre_recipient_amount: u64,
        timestamp_before_tx: i64,
    ) {
        let post_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist after CompleteUnlock");

        // Invariant 1: Pre-state must be Unlocking and recipient address must match.
        let (start_aggregator, start_timestamp) = match &pre_pp.state {
            PerformancePackageState::Unlocking {
                startAggregator,
                startTimestamp,
            } => (*startAggregator, *startTimestamp),
            _ => panic!("Pre-state must be Unlocking if CompleteUnlock succeeded"),
        };
        assert_eq!(
            recipient, pre_pp.recipient,
            "token_recipient account must match PerformancePackage.recipient"
        );
        assert_eq!(
            performance_package_token_vault, pre_pp.performancePackageTokenVault,
            "Passed vault must match PerformancePackage.performancePackageTokenVault"
        );
        assert_eq!(
            token_mint, pre_pp.tokenMint,
            "Passed token_mint must match PerformancePackage.tokenMint"
        );

        // Read oracle bytes to recompute TWAP
        let oracle_acc = self.trident.get_account(&oracle_account);
        let oracle_data = oracle_acc.data();
        let offset = pre_pp.oracleConfig.byteOffset as usize;
        assert!(
            oracle_data.len() >= offset + 24,
            "Oracle account must have at least offset+24 bytes"
        );
        let current_aggregator =
            u128::from_le_bytes(oracle_data[offset..offset + 16].try_into().unwrap());
        let last_updated_timestamp =
            i64::from_le_bytes(oracle_data[offset + 16..offset + 24].try_into().unwrap());

        let timestamp_after_tx = self.trident.get_current_timestamp();
        assert!(
            timestamp_after_tx >= last_updated_timestamp,
            "Clock must be >= oracle last_updated_timestamp if CompleteUnlock succeeded"
        );

        let time_passed = last_updated_timestamp - start_timestamp;
        assert!(
            time_passed >= pre_pp.twapLengthSeconds as i64,
            "time_passed must be >= twapLengthSeconds if CompleteUnlock succeeded"
        );
        assert!(time_passed > 0, "time_passed must be > 0 for TWAP division");

        let aggregator_change = current_aggregator.saturating_sub(start_aggregator);
        let twap_price = aggregator_change / (time_passed as u128);

        // Compute expected tokens_to_unlock and expected tranche unlock flags.
        let mut expected_tokens_to_unlock: u64 = 0;
        let mut expected_tranches = pre_pp.tranches.clone();
        for tranche in expected_tranches.iter_mut() {
            if tranche.isUnlocked {
                continue;
            }
            if twap_price >= tranche.priceThreshold {
                expected_tokens_to_unlock = expected_tokens_to_unlock
                    .checked_add(tranche.tokenAmount)
                    .expect("tokens_to_unlock overflow should be impossible");
                tranche.isUnlocked = true;
            } else {
                break;
            }
        }
        let expected_already_unlocked = pre_pp
            .alreadyUnlockedAmount
            .checked_add(expected_tokens_to_unlock)
            .expect("alreadyUnlockedAmount overflow should be impossible");

        // Invariant 2: Post-state must reset back to Locked and seqNum increments by exactly 1.
        assert!(
            matches!(post_pp.state, PerformancePackageState::Locked),
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

        // Invariant 3: alreadyUnlockedAmount and tranche unlock flags must reflect TWAP logic.
        assert_eq!(
            post_pp.alreadyUnlockedAmount, expected_already_unlocked,
            "alreadyUnlockedAmount must increase by exactly tokens_to_unlock"
        );
        assert_eq!(
            post_pp.tranches.len(),
            expected_tranches.len(),
            "Tranche count must not change"
        );
        for (i, (post_t, exp_t)) in post_pp
            .tranches
            .iter()
            .zip(expected_tranches.iter())
            .enumerate()
        {
            assert_eq!(
                post_t.isUnlocked, exp_t.isUnlocked,
                "Tranche[{i}].isUnlocked must match expected unlock based on TWAP"
            );
            assert_eq!(
                post_t.priceThreshold, exp_t.priceThreshold,
                "Tranche[{i}].priceThreshold must not change"
            );
            assert_eq!(
                post_t.tokenAmount, exp_t.tokenAmount,
                "Tranche[{i}].tokenAmount must not change"
            );
        }

        // Invariant 4: token accounting must match expected_tokens_to_unlock.
        let post_vault = self
            .trident
            .get_token_account(performance_package_token_vault)
            .expect("Vault must exist after CompleteUnlock")
            .account;
        let post_recipient = self
            .trident
            .get_token_account(recipient_token_account)
            .expect("Recipient token account must exist after CompleteUnlock")
            .account;

        assert_eq!(
            post_vault.mint, token_mint,
            "Vault mint must match token_mint"
        );
        assert_eq!(
            post_vault.owner, performance_package,
            "Vault owner must be the performance_package PDA"
        );
        assert_eq!(
            post_recipient.mint, token_mint,
            "Recipient token account mint must match token_mint"
        );
        assert_eq!(
            post_recipient.owner, recipient,
            "Recipient token account owner must match recipient"
        );

        let vault_delta = pre_vault_amount
            .checked_sub(post_vault.amount)
            .expect("Vault amount must not increase during CompleteUnlock");
        let recipient_delta = post_recipient
            .amount
            .checked_sub(pre_recipient_amount)
            .expect("Recipient amount must not decrease during CompleteUnlock");

        assert_eq!(
            vault_delta, expected_tokens_to_unlock,
            "Vault must decrease by exactly tokens_to_unlock"
        );
        assert_eq!(
            recipient_delta, expected_tokens_to_unlock,
            "Recipient token account must increase by exactly tokens_to_unlock"
        );

        // Invariant 5: global accounting must remain consistent.
        assert!(
            post_pp.alreadyUnlockedAmount <= post_pp.totalTokenAmount,
            "alreadyUnlockedAmount must not exceed totalTokenAmount"
        );

        // Invariant 6: CompleteUnlock must not mutate unrelated fields.
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
        assert!(
            timestamp_before_tx <= timestamp_after_tx,
            "Timestamp must not go backwards"
        );
    }
}
