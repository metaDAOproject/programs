#![allow(clippy::too_many_arguments)]

use crate::common::constants::PERFORMANCE_PACKAGE_SEED_PREFIX;
use crate::common::constants::TOKEN_PROGRAM_ID;
use crate::common::types::price_based_performance_package;
use crate::common::types::price_based_performance_package::InitializePerformancePackageParams;
use crate::common::types::price_based_performance_package::PerformancePackage;
use crate::common::types::price_based_performance_package::PerformancePackageState;
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;

impl FuzzTest {
    pub fn verify_initialize_performance_package_invariants(
        &mut self,
        performance_package: Pubkey,
        create_key: Pubkey,
        token_mint: Pubkey,
        grantor_token_account: Pubkey,
        grantor: Pubkey,
        performance_package_token_vault: Pubkey,
        args: &InitializePerformancePackageParams,
        initial_grantor_token_amount: u64,
        initial_vault_token_amount: u64,
        timestamp_before_tx: i64,
    ) {
        let pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage account must exist after initialization");

        // Invariant 1: `performance_package` address, stored `createKey`, and stored `pdaBump`
        // must match PDA derivation from seeds used by the program.
        let (expected_pda, expected_bump) = self.trident.find_program_address(
            &[PERFORMANCE_PACKAGE_SEED_PREFIX, create_key.as_ref()],
            &price_based_performance_package::program_id(),
        );
        assert_eq!(
            performance_package, expected_pda,
            "PerformancePackage PDA must match seeds (performance_package, create_key)"
        );
        assert_eq!(
            pp.createKey, create_key,
            "Stored createKey must match the signer used to derive the PDA"
        );
        assert_eq!(
            pp.pdaBump, expected_bump,
            "Stored pdaBump must match PDA derivation bump"
        );

        // Invariant 2: all static fields persisted into `PerformancePackage` must match the
        // instruction inputs and the expected initial state.
        assert_eq!(
            pp.minUnlockTimestamp, args.minUnlockTimestamp,
            "Stored minUnlockTimestamp must match args"
        );
        assert_eq!(
            pp.twapLengthSeconds, args.twapLengthSeconds,
            "Stored twapLengthSeconds must match args"
        );
        assert_eq!(
            pp.oracleConfig.oracleAccount, args.oracleConfig.oracleAccount,
            "Stored oracleConfig.oracleAccount must match args"
        );
        assert_eq!(
            pp.oracleConfig.byteOffset, args.oracleConfig.byteOffset,
            "Stored oracleConfig.byteOffset must match args"
        );
        assert_eq!(
            pp.recipient, args.grantee,
            "Stored recipient must match args.grantee"
        );
        assert_eq!(
            pp.performancePackageAuthority, args.performancePackageAuthority,
            "Stored performancePackageAuthority must match args"
        );
        assert_eq!(
            pp.tokenMint, token_mint,
            "Stored tokenMint must match the token_mint account"
        );
        assert_eq!(
            pp.performancePackageTokenVault, performance_package_token_vault,
            "Stored performancePackageTokenVault must match the provided vault account"
        );
        assert_eq!(
            pp.alreadyUnlockedAmount, 0,
            "alreadyUnlockedAmount must start at 0"
        );
        assert_eq!(pp.seqNum, 0, "seqNum must start at 0 on initialization");
        assert!(
            matches!(pp.state, PerformancePackageState::Locked),
            "PerformancePackage state must start as Locked"
        );

        // Invariant 3: tranches must be stored 1:1 with input tranches, and each stored tranche
        // must start as locked (`isUnlocked=false`). Also, totalTokenAmount must equal the
        // overflow-safe sum of tranche token amounts.
        assert_eq!(
            pp.tranches.len(),
            args.tranches.len(),
            "Stored tranche count must match args.tranches.len()"
        );

        let mut expected_total_u128: u128 = 0;
        for (i, (stored, input)) in pp.tranches.iter().zip(args.tranches.iter()).enumerate() {
            assert_eq!(
                stored.priceThreshold, input.priceThreshold,
                "Stored tranche[{i}].priceThreshold must match args"
            );
            assert_eq!(
                stored.tokenAmount, input.tokenAmount,
                "Stored tranche[{i}].tokenAmount must match args"
            );
            assert!(
                !stored.isUnlocked,
                "Stored tranche[{i}] must start locked (isUnlocked=false)"
            );
            expected_total_u128 = expected_total_u128.saturating_add(input.tokenAmount as u128);
        }

        assert!(
            expected_total_u128 <= u64::MAX as u128,
            "Sum of tranche token amounts must fit in u64 (no overflow)"
        );
        let expected_total = expected_total_u128 as u64;

        assert_eq!(
            pp.totalTokenAmount, expected_total,
            "Stored totalTokenAmount must equal sum(args.tranches[*].tokenAmount)"
        );

        // Invariant 4: the token vault must be the ATA for (owner=performance_package, mint=token_mint)
        // under the SPL Token program, and the on-chain state must point to that same vault.
        let expected_ata = self.trident.get_associated_token_address(
            &token_mint,
            &performance_package,
            &TOKEN_PROGRAM_ID,
        );
        assert_eq!(
            performance_package_token_vault, expected_ata,
            "performance_package_token_vault must be the ATA of the performance_package PDA"
        );

        // Invariant 5: token accounting must be correct:
        // - grantor_token_account decreases by totalTokenAmount
        // - performance_package_token_vault increases by totalTokenAmount
        // - vault mint/owner must be (token_mint, performance_package)
        let final_grantor_acc = self
            .trident
            .get_token_account(grantor_token_account)
            .expect("Grantor token account must exist after initialization")
            .account;
        let final_vault_acc = self
            .trident
            .get_token_account(performance_package_token_vault)
            .expect("Performance package vault must exist after initialization")
            .account;

        assert_eq!(
            final_grantor_acc.mint, token_mint,
            "Grantor token account mint must equal token_mint"
        );
        assert_eq!(
            final_grantor_acc.owner, grantor,
            "Grantor token account owner must equal grantor"
        );
        assert_eq!(
            final_vault_acc.mint, token_mint,
            "Vault mint must equal token_mint"
        );
        assert_eq!(
            final_vault_acc.owner, performance_package,
            "Vault owner must be the performance_package PDA"
        );

        let grantor_spent = initial_grantor_token_amount
            .checked_sub(final_grantor_acc.amount)
            .expect("Grantor token account amount must not increase during initialization");
        let vault_received = final_vault_acc
            .amount
            .checked_sub(initial_vault_token_amount)
            .expect("Vault token account amount must not decrease during initialization");

        assert_eq!(
            grantor_spent, expected_total,
            "Grantor must spend exactly totalTokenAmount"
        );
        assert_eq!(
            vault_received, expected_total,
            "Vault must receive exactly totalTokenAmount"
        );

        // Invariant 6: minUnlockTimestamp must remain strictly in the future relative to when the
        // instruction executed (it was required by the program).
        assert!(
            pp.minUnlockTimestamp > timestamp_before_tx,
            "minUnlockTimestamp must be > current time at initialization"
        );
    }
}
