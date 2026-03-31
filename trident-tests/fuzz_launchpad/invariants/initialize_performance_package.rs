#![allow(clippy::too_many_arguments)]

use crate::common::constants::PERFORMANCE_PACKAGE_SEED_PREFIX;
use crate::common::constants::TOKEN_PROGRAM_ID;
use crate::common::types::launchpad_v_7::Launch;
use crate::common::types::launchpad_v_7::LaunchState;
use crate::common::types::price_based_performance_package::PerformancePackage;
use crate::common::types::price_based_performance_package::PerformancePackageState;
use crate::common::types::price_based_performance_package::{self};
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;

use trident_fuzz::invariant;
use trident_fuzz::invariant_eq;

impl FuzzTest {
    pub fn verify_initialize_performance_package_invariants(
        &mut self,
        launch: Pubkey,
        launch_signer: Pubkey,
        launch_base_vault: Pubkey,
        base_mint: Pubkey,
        dao: Pubkey,
        squads_multisig_vault: Pubkey,
        performance_package: Pubkey,
        performance_package_token_account: Pubkey,
        pre_launch: &Launch,
        pre_launch_base_vault_amount: u64,
        pre_pp_vault_amount: u64,
    ) {
        const TOKENS_TO_PARTICIPANTS: u64 = 10_000_000 * 1_000_000;
        const PRICE_SCALE: u128 = 1_000_000_000_000;
        const THREE_MONTHS_SECONDS: u32 = 3 * 30 * 24 * 60 * 60;

        let post_launch = self
            .trident
            .get_account_with_type::<Launch>(&launch, Some(8))
            .expect("Launch account must exist after InitializePerformancePackage");

        // Invariant 1: Precondition checks.
        invariant!(
            matches!(pre_launch.state, LaunchState::Complete),
            "pre-state must be Complete if InitializePerformancePackage succeeded"
        );
        invariant!(
            !pre_launch.isPerformancePackageInitialized,
            "isPerformancePackageInitialized must be false if InitializePerformancePackage succeeded"
        );
        invariant_eq!(
            pre_launch.dao,
            Some(dao),
            "launch.dao must equal dao if tx succeeded"
        );
        invariant_eq!(
            pre_launch.launchSigner,
            launch_signer,
            "launch_signer must match Launch.launchSigner"
        );
        invariant_eq!(
            pre_launch.launchBaseVault,
            launch_base_vault,
            "launch_base_vault must match Launch.launchBaseVault"
        );
        invariant_eq!(
            pre_launch.baseMint,
            base_mint,
            "base_mint must match Launch.baseMint"
        );

        // Invariant 2: Launch mutations must be correct.
        invariant!(
            post_launch.isPerformancePackageInitialized,
            "isPerformancePackageInitialized must flip true"
        );
        invariant_eq!(
            post_launch.seqNum,
            pre_launch
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "Launch.seqNum must increment by exactly 1"
        );

        // Invariant 3: PBPP PerformancePackage must exist and match PDA derivation.
        let post_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist after InitializePerformancePackage");

        let (expected_pp_pda, expected_pp_bump) = self.trident.find_program_address(
            &[PERFORMANCE_PACKAGE_SEED_PREFIX, launch_signer.as_ref()],
            &price_based_performance_package::program_id(),
        );
        invariant_eq!(
            performance_package,
            expected_pp_pda,
            "PerformancePackage PDA must match seeds (performance_package, launch_signer)"
        );
        invariant_eq!(
            post_pp.createKey,
            launch_signer,
            "PerformancePackage.createKey must equal launch_signer"
        );
        invariant_eq!(
            post_pp.pdaBump,
            expected_pp_bump,
            "PerformancePackage.pdaBump must match PDA bump"
        );

        // Invariant 4: PerformancePackage static fields must match expected values.
        invariant_eq!(
            post_pp.tokenMint,
            base_mint,
            "PerformancePackage.tokenMint must equal base_mint"
        );
        invariant_eq!(
            post_pp.recipient,
            pre_launch.performancePackageGrantee,
            "PerformancePackage.recipient must equal performance_package_grantee"
        );
        invariant_eq!(
            post_pp.performancePackageAuthority,
            squads_multisig_vault,
            "PerformancePackage.performancePackageAuthority must equal squads_multisig_vault"
        );
        invariant_eq!(
            post_pp.oracleConfig.oracleAccount,
            dao,
            "PerformancePackage.oracleAccount must be dao"
        );
        invariant_eq!(
            post_pp.oracleConfig.byteOffset,
            9,
            "PerformancePackage.oracle byteOffset must be 8 + 1"
        );
        invariant_eq!(
            post_pp.twapLengthSeconds,
            THREE_MONTHS_SECONDS,
            "twapLengthSeconds must be 3 months"
        );
        invariant!(
            matches!(post_pp.state, PerformancePackageState::Locked),
            "PerformancePackage must start Locked"
        );
        invariant_eq!(
            post_pp.seqNum,
            0,
            "PerformancePackage.seqNum must start at 0"
        );
        invariant_eq!(
            post_pp.alreadyUnlockedAmount,
            0,
            "alreadyUnlockedAmount must start at 0"
        );

        // Invariant 5: Tranches must match expected structure (5 tranches, thresholds 2x..32x).
        invariant_eq!(post_pp.tranches.len(), 5, "must have exactly 5 tranches");
        let tranche_amount = pre_launch.performancePackageTokenAmount / 5;
        let expected_total = tranche_amount * 5;
        let launch_price_1e12: u128 = ((pre_launch.totalApprovedAmount as u128) * PRICE_SCALE)
            / (TOKENS_TO_PARTICIPANTS as u128);

        let expected_thresholds = [
            launch_price_1e12 * 2,
            launch_price_1e12 * 4,
            launch_price_1e12 * 8,
            launch_price_1e12 * 16,
            launch_price_1e12 * 32,
        ];

        for (i, tranche) in post_pp.tranches.iter().enumerate() {
            invariant_eq!(
                tranche.tokenAmount,
                tranche_amount,
                "tranche[{i}].tokenAmount must be performancePackageTokenAmount/5"
            );
            invariant_eq!(
                tranche.priceThreshold,
                expected_thresholds[i],
                "tranche[{i}].priceThreshold must match expected multiple"
            );
            invariant!(!tranche.isUnlocked, "tranche[{i}] must start locked");
        }
        invariant_eq!(
            post_pp.totalTokenAmount,
            expected_total,
            "totalTokenAmount must equal sum(tranche token amounts)"
        );

        // Invariant 6: minUnlockTimestamp must match completed + months*30d.
        let completed = pre_launch.unixTimestampCompleted.expect(
            "unixTimestampCompleted must be Some if InitializePerformancePackage succeeded",
        );
        let expected_min_unlock = completed
            .saturating_add(pre_launch.monthsUntilInsidersCanUnlock as i64 * 30 * 24 * 60 * 60);
        invariant_eq!(
            post_pp.minUnlockTimestamp,
            expected_min_unlock,
            "minUnlockTimestamp must match expected"
        );

        // Invariant 7: PBPP token vault must be ATA(base_mint, performance_package) and be stored correctly.
        let expected_pp_vault = self.trident.get_associated_token_address(
            &base_mint,
            &performance_package,
            &TOKEN_PROGRAM_ID,
        );
        invariant_eq!(
            performance_package_token_account,
            expected_pp_vault,
            "performance_package_token_account must be ATA(base_mint, performance_package)"
        );
        invariant_eq!(
            post_pp.performancePackageTokenVault,
            performance_package_token_account,
            "stored PerformancePackageTokenVault must match passed account"
        );

        // Invariant 8: Token accounting must reflect a transfer of expected_total from launch_base_vault -> pp_vault.
        let post_launch_base_vault_amount = self
            .trident
            .get_token_account(launch_base_vault)
            .expect("launch_base_vault must exist after InitializePerformancePackage")
            .account
            .amount;
        let post_pp_vault_amount = self
            .trident
            .get_token_account(performance_package_token_account)
            .expect("pp vault must exist after InitializePerformancePackage")
            .account
            .amount;

        let base_vault_delta = pre_launch_base_vault_amount
            .checked_sub(post_launch_base_vault_amount)
            .expect("launch_base_vault must not increase");
        let pp_vault_delta = post_pp_vault_amount
            .checked_sub(pre_pp_vault_amount)
            .expect("pp vault must not decrease");
        invariant_eq!(
            base_vault_delta,
            expected_total,
            "launch_base_vault must decrease by expected_total"
        );
        invariant_eq!(
            pp_vault_delta,
            expected_total,
            "pp vault must increase by expected_total"
        );
    }
}
