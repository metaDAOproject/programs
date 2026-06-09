use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
    pub mint_governor_seq_num: u64,
}

#[event]
pub struct MintGovernorInitializedEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub mint: Pubkey,
    pub admin: Pubkey,
    pub create_key: Pubkey,
    pub pda_bump: u8,
}

#[event]
pub struct MintAuthorityTransferredEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub mint: Pubkey,
}

#[event]
pub struct MintAuthorityAddedEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub mint_authority: Pubkey,
    pub authorized_minter: Pubkey,
    pub max_total: Option<u64>,
}

#[event]
pub struct TokensMintedEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub mint: Pubkey,
    pub authorized_minter: Pubkey,
    pub destination_ata: Pubkey,
    pub amount: u64,
    pub post_total_minted: u64,
    pub authority_max_total: Option<u64>,
    pub post_mint_supply: u64,
}

#[event]
pub struct MintAuthorityUpdatedEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub mint_authority: Pubkey,
    pub authorized_minter: Pubkey,
    pub max_total: Option<u64>,
    pub total_minted: u64,
}

#[event]
pub struct MintAuthorityRemovedEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub mint_authority: Pubkey,
    pub authorized_minter: Pubkey,
    pub max_total: Option<u64>,
    pub total_minted: u64,
}

#[event]
pub struct MintGovernorAdminUpdatedEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub new_admin: Pubkey,
}

#[event]
pub struct MintAuthorityReclaimedEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub mint: Pubkey,
    pub new_authority: Pubkey,
}
