use anchor_lang::prelude::*;

pub const PERFORMANCE_PACKAGE_SEED: &[u8] = b"performance_package";
pub const CHANGE_REQUEST_SEED: &[u8] = b"change_request";

#[constant]
pub const MAX_TRANCHES: usize = 10;

#[constant]
pub const MAX_MIN_DURATION: u32 = 60 * 60 * 24 * 365; // 365 days in seconds
