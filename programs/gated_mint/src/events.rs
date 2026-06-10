use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
    pub gated_mint_config_seq_num: u64,
}

impl CommonFields {
    pub fn new(clock: &Clock, seq_num: u64) -> Self {
        Self {
            slot: clock.slot,
            unix_timestamp: clock.unix_timestamp,
            gated_mint_config_seq_num: seq_num,
        }
    }
}

#[event]
pub struct GatedMintInitializedEvent {
    pub common: CommonFields,
    pub gated_mint_config: Pubkey,
    pub mint: Pubkey,
    pub admin: Pubkey,
    pub whitelist_admin: Option<Pubkey>,
    pub previous_freeze_authority: Pubkey,
    pub pda_bump: u8,
}

#[event]
pub struct WhitelistedUserAddedEvent {
    pub common: CommonFields,
    pub gated_mint_config: Pubkey,
    pub whitelisted_user: Pubkey,
    pub mint: Pubkey,
    pub user: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct WhitelistedUserRemovedEvent {
    pub common: CommonFields,
    pub gated_mint_config: Pubkey,
    pub whitelisted_user: Pubkey,
    pub mint: Pubkey,
    pub user: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct WhitelistAdminSetEvent {
    pub common: CommonFields,
    pub gated_mint_config: Pubkey,
    pub mint: Pubkey,
    pub previous_whitelist_admin: Option<Pubkey>,
    pub new_whitelist_admin: Option<Pubkey>,
}

#[event]
pub struct GatedInvokeEvent {
    pub common: CommonFields,
    pub gated_mint_config: Pubkey,
    pub mint: Pubkey,
    pub caller: Pubkey,
    pub target_program: Pubkey,
    pub thawed_count: u32,
    pub frozen_count: u32,
}

#[event]
pub struct GatingDisabledEvent {
    pub common: CommonFields,
    pub gated_mint_config: Pubkey,
    pub mint: Pubkey,
}

#[event]
pub struct AccountThawedEvent {
    pub common: CommonFields,
    pub gated_mint_config: Pubkey,
    pub mint: Pubkey,
    pub token_account: Pubkey,
}
