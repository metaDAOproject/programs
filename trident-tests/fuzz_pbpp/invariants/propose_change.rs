use crate::common::constants::CHANGE_REQUEST_SEED_PREFIX;
use crate::common::types::price_based_performance_package;
use crate::common::types::price_based_performance_package::ChangeRequest;
use crate::common::types::price_based_performance_package::ChangeType;
use crate::common::types::price_based_performance_package::PerformancePackage;
use crate::common::types::price_based_performance_package::ProposeChangeParams;
use crate::common::types::price_based_performance_package::ProposerType;
use crate::FuzzTest;
use trident_fuzz::fuzzing::Pubkey;

use trident_fuzz::invariant;
use trident_fuzz::invariant_eq;

impl FuzzTest {
    pub fn verify_propose_change_invariants(
        &mut self,
        change_request: Pubkey,
        performance_package: Pubkey,
        proposer: Pubkey,
        args: &ProposeChangeParams,
        pre_pp: &PerformancePackage,
        timestamp_before_tx: i64,
    ) {
        let post_cr = self
            .trident
            .get_account_with_type::<ChangeRequest>(&change_request, Some(8))
            .expect("ChangeRequest must exist after ProposeChange");

        let post_pp = self
            .trident
            .get_account_with_type::<PerformancePackage>(&performance_package, Some(8))
            .expect("PerformancePackage must exist after ProposeChange");

        // Invariant 1: `change_request` address must match PDA derivation from the program seeds.
        let (expected_pda, expected_bump) = self.trident.find_program_address(
            &[
                CHANGE_REQUEST_SEED_PREFIX,
                performance_package.as_ref(),
                proposer.as_ref(),
                args.pdaNonce.to_le_bytes().as_ref(),
            ],
            &price_based_performance_package::program_id(),
        );
        invariant_eq!(
            change_request, expected_pda,
            "ChangeRequest PDA must match seeds (change_request, performance_package, proposer, pda_nonce)"
        );
        invariant_eq!(
            post_cr.pdaBump,
            expected_bump,
            "Stored pdaBump must match PDA derivation bump"
        );

        // Invariant 2: change_request must point to the correct performance_package.
        invariant_eq!(
            post_cr.performancePackage,
            performance_package,
            "ChangeRequest.performancePackage must equal the provided performance_package"
        );

        // Invariant 3: proposerType must reflect whether proposer is recipient or authority in the
        // pre-state performance package.
        let expected_proposer_type = if proposer == pre_pp.recipient {
            ProposerType::Recipient
        } else if proposer == pre_pp.performancePackageAuthority {
            ProposerType::Authority
        } else {
            panic!("proposer must be recipient or performance package authority if tx succeeded");
        };
        match (&post_cr.proposerType, expected_proposer_type) {
            (ProposerType::Recipient, ProposerType::Recipient)
            | (ProposerType::Authority, ProposerType::Authority) => {}
            _ => panic!("ChangeRequest.proposerType must match expected proposer type"),
        }

        // Invariant 4: pdaNonce must be stored exactly as provided.
        invariant_eq!(
            post_cr.pdaNonce,
            args.pdaNonce,
            "ChangeRequest.pdaNonce must equal args.pdaNonce"
        );

        // Invariant 5: changeType stored in ChangeRequest must match args.changeType.
        // (We compare variant + contained fields explicitly.)
        match (&post_cr.changeType, &args.changeType) {
            (
                ChangeType::Oracle { newOracleConfig: a },
                ChangeType::Oracle { newOracleConfig: b },
            ) => {
                invariant_eq!(
                    a.oracleAccount,
                    b.oracleAccount,
                    "Oracle change must store newOracleConfig.oracleAccount correctly"
                );
                invariant_eq!(
                    a.byteOffset,
                    b.byteOffset,
                    "Oracle change must store newOracleConfig.byteOffset correctly"
                );
            }
            (
                ChangeType::Recipient { newRecipient: a },
                ChangeType::Recipient { newRecipient: b },
            ) => {
                invariant_eq!(a, b, "Recipient change must store newRecipient correctly");
            }
            _ => panic!("ChangeRequest.changeType must match args.changeType variant"),
        }

        // Invariant 6: proposedAt must be within [timestamp_before_tx, now].
        let timestamp_after_tx = self.trident.get_current_timestamp();
        invariant!(
            post_cr.proposedAt >= timestamp_before_tx,
            "proposedAt must be >= timestamp before tx"
        );
        invariant!(
            post_cr.proposedAt <= timestamp_after_tx,
            "proposedAt must be <= timestamp after tx"
        );

        // Invariant 7: ProposeChange must not mutate the PerformancePackage state
        // (it only creates a ChangeRequest).
        invariant_eq!(
            post_pp.recipient,
            pre_pp.recipient,
            "PerformancePackage.recipient must not change on ProposeChange"
        );
        invariant_eq!(
            post_pp.performancePackageAuthority,
            pre_pp.performancePackageAuthority,
            "PerformancePackage.performancePackageAuthority must not change on ProposeChange"
        );
        invariant_eq!(
            post_pp.oracleConfig.oracleAccount,
            pre_pp.oracleConfig.oracleAccount,
            "PerformancePackage.oracleConfig.oracleAccount must not change on ProposeChange"
        );
        invariant_eq!(
            post_pp.oracleConfig.byteOffset,
            pre_pp.oracleConfig.byteOffset,
            "PerformancePackage.oracleConfig.byteOffset must not change on ProposeChange"
        );

        // Invariant 8: ProposeChange increments seqNum by exactly 1.
        invariant_eq!(
            post_pp.seqNum,
            pre_pp
                .seqNum
                .checked_add(1)
                .expect("seqNum overflow should be impossible"),
            "PerformancePackage.seqNum must increment by exactly 1 on ProposeChange"
        );
    }
}
