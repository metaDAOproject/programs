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
    pub performancePackage: AddressStorage,

    pub createKey: AddressStorage,

    pub tokenMint: AddressStorage,

    pub oracleAccount: AddressStorage,

    pub recipient: AddressStorage,

    pub recipientTokenAccount: AddressStorage,

    pub currentAuthority: AddressStorage,
}
