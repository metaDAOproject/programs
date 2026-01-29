use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
    pub performance_package_seq_num: u64,
}
