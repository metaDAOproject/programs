use anchor_lang::prelude::*;

pub const PERFORMANCE_PACKAGE_SEED: &[u8] = b"performance_package";
pub const CHANGE_REQUEST_SEED: &[u8] = b"change_request";

#[constant]
pub const MAX_TRANCHES: usize = 10;

pub mod admin {
    use anchor_lang::prelude::declare_id;

    // MetaDAO operational multisig
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}
