use trident_fuzz::fuzzing::*;

// ============================================================================
// Addresses
pub const SQUADS_PROGRAM_ID: Pubkey = pubkey!("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf");
pub const SQUADS_PROGRAM_CONFIG_ID: Pubkey =
    pubkey!("BSTq9w3kZwNwpBXJEvTZz2G9ZTNyKBvoSeXMvwb4cNZr");
pub const SQUADS_PROGRAM_CONFIG_TREASURY_ID: Pubkey =
    pubkey!("5DH2e3cJmFpyi6mk65EGFediunm4ui6BiKNUNrhWtD1b");
pub const TOKEN_PROGRAM_ID: Pubkey = pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
pub const _TOKEN_2022_PROGRAM_ID: Pubkey = pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
pub const ASSOCIATED_TOKEN_PROGRAM_ID: Pubkey =
    pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
pub const SOLANA_PROGRAM_ID: Pubkey = pubkey!("11111111111111111111111111111111");
pub const USDC_MINT: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
pub const MPL_TOKEN_METADATA_PROGRAM_ID: Pubkey =
    pubkey!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
pub const RENT_SYSVAR_ID: Pubkey = pubkey!("SysvarRent111111111111111111111111111111111");
pub const DAMM_V2_PROGRAM_ID: Pubkey = pubkey!("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG");
pub const METEORA_CONFIG_ID: Pubkey = pubkey!("FaA6RM9enPh1tU9Y8LiGCq715JubLc49WGcYTdNvDfsc");
pub const FEE_RECIPIENT_ID: Pubkey = pubkey!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
pub const TOKEN_2022_PROGRAM_ID: Pubkey = pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
// ============================================================================

// ============================================================================
// Seeds
pub const SQUADS_SEED_PREFIX: &[u8] = b"multisig";
pub const SQUADS_SEED_MULTISIG: &[u8] = b"multisig";
pub const SQUADS_SEED_VAULT: &[u8] = b"vault";
pub const SQUADS_SEED_SPENDING_LIMIT: &[u8] = b"spending_limit";
pub const DAO_SEED_PREFIX: &[u8] = b"dao";
pub const PROPOSAL_SEED_PREFIX: &[u8] = b"proposal";
pub const CONDITIONAL_VAULT_SEED_PREFIX: &[u8] = b"conditional_vault";
pub const QUESTION_SEED_PREFIX: &[u8] = b"question";
pub const CONDITIONAL_TOKEN_SEED_PREFIX: &[u8] = b"conditional_token";
pub const STAKE_SEED_PREFIX: &[u8] = b"stake";
pub const AMM_POSITION_SEED_PREFIX: &[u8] = b"amm_position";
pub const PERFORMANCE_PACKAGE_SEED_PREFIX: &[u8] = b"performance_package";
pub const CHANGE_REQUEST_SEED_PREFIX: &[u8] = b"change_request";
pub const SQUADS_SEED_PROGRAM_CONFIG: &[u8] = b"program_config";
pub const POOL_CREATOR_AUTHORITY_SEED: &[u8] = b"damm_pool_creator_authority";
pub const POOL_AUTHORITY_SEED: &[u8] = b"pool_authority";
pub const POOL_PREFIX: &[u8] = b"pool";
pub const POSITION_NFT_ACCOUNT_PREFIX: &[u8] = b"position_nft_account";
pub const POSITION_PREFIX: &[u8] = b"position";
pub const POSITION_NFT_MINT_PREFIX: &[u8] = b"position_nft_mint";
pub const TOKEN_VAULT_PREFIX: &[u8] = b"token_vault";
pub const BID_WALL_PREFIX: &[u8] = b"bid_wall";
pub const LAUNCHPAD_SEED_PREFIX: &[u8] = b"launch";
pub const TOKEN_METADATA_SEED_PREFIX: &[u8] = b"metadata";
pub const LAUNCH_SIGNER_SEED_PREFIX: &[u8] = b"launch_signer";
pub const FUNDING_RECORD_SEED_PREFIX: &[u8] = b"funding_record";
// ============================================================================

// ============================================================================
// Constants
pub const EVENT_AUTHORITY_SEED: &[u8] = b"__event_authority";
// ============================================================================

// ============================================================================
// Squads Multisig

pub fn permissionless_account() -> Keypair {
    Keypair::new_from_array([
        249, 158, 188, 171, 243, 143, 1, 48, 87, 243, 209, 153, 144, 106, 23, 88, 161, 209, 65,
        217, 199, 121, 0, 250, 3, 203, 133, 138, 141, 112, 243, 38,
    ])
}
// ============================================================================
