#![allow(non_snake_case)]
use trident_fuzz::fuzzing::*;

/// Storage for all account addresses used in fuzz testing.
///
/// This struct serves as a centralized repository for account addresses,
/// enabling their reuse across different instruction flows and test scenarios.
///
/// Docs: https://ackee.xyz/trident/docs/latest/trident-api-macro/trident-types/fuzz-accounts/
#[derive(Default)]
pub struct AccountAddresses {
    pub launch: AddressStorage,

    pub baseMint: AddressStorage,

    pub tokenMetadata: AddressStorage,

    pub launchSigner: AddressStorage,

    pub launchAuthority: AddressStorage,

    pub quoteMint: AddressStorage,

    pub fundingRecord: AddressStorage,

    pub funder: AddressStorage,

    pub additionalTokensRecipient: AddressStorage,

    pub feeRecipient: AddressStorage,
}
