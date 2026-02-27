use super::constants::*;
use super::types::bid_wall;
use super::types::conditional_vault;
use super::types::futarchy;
use super::types::launchpad_v_7;
use super::types::price_based_performance_package;

use trident_fuzz::fuzzing::*;

/// Standalone PDA helper functions that work with Trident directly
pub fn get_proposal_pda(trident: &mut Trident, squads_proposal: Pubkey) -> Pubkey {
    trident
        .find_program_address(
            &[PROPOSAL_SEED_PREFIX, squads_proposal.as_ref()],
            &futarchy::program_id(),
        )
        .0
}

pub fn get_performance_package_pda(trident: &mut Trident, create_key: Pubkey) -> Pubkey {
    trident
        .find_program_address(
            &[PERFORMANCE_PACKAGE_SEED_PREFIX, create_key.as_ref()],
            &price_based_performance_package::program_id(),
        )
        .0
}

pub fn get_change_request_pda(
    trident: &mut Trident,
    performance_package: Pubkey,
    proposer: Pubkey,
    pda_nonce: u32,
) -> Pubkey {
    trident
        .find_program_address(
            &[
                CHANGE_REQUEST_SEED_PREFIX,
                performance_package.as_ref(),
                proposer.as_ref(),
                pda_nonce.to_le_bytes().as_ref(),
            ],
            &price_based_performance_package::program_id(),
        )
        .0
}

pub fn get_launchpad_pda(trident: &mut Trident, base_mint: Pubkey) -> Pubkey {
    trident
        .find_program_address(
            &[LAUNCHPAD_SEED_PREFIX, base_mint.as_ref()],
            &launchpad_v_7::program_id(),
        )
        .0
}
pub fn get_token_metadata_pda(trident: &mut Trident, base_mint: Pubkey) -> Pubkey {
    trident
        .find_program_address(
            &[
                TOKEN_METADATA_SEED_PREFIX,
                MPL_TOKEN_METADATA_PROGRAM_ID.as_ref(),
                base_mint.as_ref(),
            ],
            &MPL_TOKEN_METADATA_PROGRAM_ID,
        )
        .0
}
pub fn get_launch_signer_pda(trident: &mut Trident, launch: Pubkey) -> Pubkey {
    trident
        .find_program_address(
            &[LAUNCH_SIGNER_SEED_PREFIX, launch.as_ref()],
            &launchpad_v_7::program_id(),
        )
        .0
}

pub fn get_funding_record_pda(trident: &mut Trident, launch: Pubkey, funder: Pubkey) -> Pubkey {
    trident
        .find_program_address(
            &[FUNDING_RECORD_SEED_PREFIX, launch.as_ref(), funder.as_ref()],
            &launchpad_v_7::program_id(),
        )
        .0
}
pub fn get_squads_program_config_pda(trident: &mut Trident) -> Pubkey {
    trident
        .find_program_address(
            &[SQUADS_SEED_PREFIX, SQUADS_SEED_PROGRAM_CONFIG],
            &SQUADS_PROGRAM_ID,
        )
        .0
}
pub fn get_pool_creator_authority_pda(trident: &mut Trident) -> Pubkey {
    trident
        .find_program_address(&[POOL_CREATOR_AUTHORITY_SEED], &launchpad_v_7::program_id())
        .0
}
pub fn get_pool_authority_pda(trident: &mut Trident) -> Pubkey {
    trident
        .find_program_address(&[POOL_AUTHORITY_SEED], &DAMM_V2_PROGRAM_ID)
        .0
}
fn max_key(left: &Pubkey, right: &Pubkey) -> [u8; 32] {
    std::cmp::max(left, right).to_bytes()
}

fn min_key(left: &Pubkey, right: &Pubkey) -> [u8; 32] {
    std::cmp::min(left, right).to_bytes()
}
pub fn get_pool_pda(
    trident: &mut Trident,
    config: Pubkey,
    base_mint: Pubkey,
    quote_mint: Pubkey,
) -> Pubkey {
    let max_key = max_key(&base_mint, &quote_mint);
    let min_key = min_key(&base_mint, &quote_mint);
    trident
        .find_program_address(
            &[
                POOL_PREFIX,
                config.as_ref(),
                max_key.as_ref(),
                min_key.as_ref(),
            ],
            &DAMM_V2_PROGRAM_ID,
        )
        .0
}
pub fn get_position_nft_account_pda(trident: &mut Trident, position_nft_mint: Pubkey) -> Pubkey {
    trident
        .find_program_address(
            &[POSITION_NFT_ACCOUNT_PREFIX, position_nft_mint.as_ref()],
            &DAMM_V2_PROGRAM_ID,
        )
        .0
}
pub fn get_position_pda(trident: &mut Trident, position_nft_mint: Pubkey) -> Pubkey {
    trident
        .find_program_address(
            &[POSITION_PREFIX, position_nft_mint.as_ref()],
            &DAMM_V2_PROGRAM_ID,
        )
        .0
}
pub fn get_position_nft_mint_pda(trident: &mut Trident, base_mint: Pubkey) -> Pubkey {
    trident
        .find_program_address(
            &[POSITION_NFT_MINT_PREFIX, base_mint.as_ref()],
            &launchpad_v_7::program_id(),
        )
        .0
}
pub fn get_token_a_vault_pda(trident: &mut Trident, base_mint: Pubkey, pool: Pubkey) -> Pubkey {
    trident
        .find_program_address(
            &[TOKEN_VAULT_PREFIX, base_mint.as_ref(), pool.as_ref()],
            &DAMM_V2_PROGRAM_ID,
        )
        .0
}
pub fn get_token_b_vault_pda(trident: &mut Trident, quote_mint: Pubkey, pool: Pubkey) -> Pubkey {
    trident
        .find_program_address(
            &[TOKEN_VAULT_PREFIX, quote_mint.as_ref(), pool.as_ref()],
            &DAMM_V2_PROGRAM_ID,
        )
        .0
}
pub fn get_bid_wall_pda(trident: &mut Trident, base_mint: Pubkey, launch_signer: Pubkey) -> Pubkey {
    trident
        .find_program_address(
            &[
                BID_WALL_PREFIX,
                base_mint.as_ref(),
                launch_signer.as_ref(),
                0_u64.to_le_bytes().as_ref(),
            ],
            &bid_wall::program_id(),
        )
        .0
}

pub fn get_conditional_vault_pda(
    trident: &mut Trident,
    question: Pubkey,
    underlying_token_mint: Pubkey,
) -> Pubkey {
    trident
        .find_program_address(
            &[
                CONDITIONAL_VAULT_SEED_PREFIX,
                question.as_ref(),
                underlying_token_mint.as_ref(),
            ],
            &conditional_vault::program_id(),
        )
        .0
}

pub fn get_event_authority_pda(trident: &mut Trident, program_id: Pubkey) -> Pubkey {
    trident
        .find_program_address(&[EVENT_AUTHORITY_SEED], &program_id)
        .0
}

pub fn get_question_pda(
    trident: &mut Trident,
    question_id: [u8; 32],
    oracle: Pubkey,
    num_outcomes: u8,
) -> Pubkey {
    trident
        .find_program_address(
            &[
                QUESTION_SEED_PREFIX,
                question_id.as_ref(),
                oracle.as_ref(),
                &[num_outcomes],
            ],
            &conditional_vault::program_id(),
        )
        .0
}

pub fn get_dao_pda(trident: &mut Trident, dao_creator: Pubkey, nonce: u64) -> Pubkey {
    trident
        .find_program_address(
            &[
                DAO_SEED_PREFIX,
                dao_creator.as_ref(),
                nonce.to_le_bytes().as_ref(),
            ],
            &futarchy::program_id(),
        )
        .0
}

pub fn get_squads_multisig_pda(trident: &mut Trident, dao: Pubkey) -> Pubkey {
    trident
        .find_program_address(
            &[SQUADS_SEED_PREFIX, SQUADS_SEED_MULTISIG, dao.as_ref()],
            &SQUADS_PROGRAM_ID,
        )
        .0
}

pub fn get_squads_multisig_vault_pda(trident: &mut Trident, squads_multisig: Pubkey) -> Pubkey {
    trident
        .find_program_address(
            &[
                SQUADS_SEED_PREFIX,
                squads_multisig.as_ref(),
                SQUADS_SEED_VAULT,
                0_u8.to_le_bytes().as_ref(),
            ],
            &SQUADS_PROGRAM_ID,
        )
        .0
}

pub fn get_squads_multisig_spending_limit_pda(
    trident: &mut Trident,
    squads_multisig: Pubkey,
    dao: Pubkey,
) -> Pubkey {
    trident
        .find_program_address(
            &[
                SQUADS_SEED_PREFIX,
                squads_multisig.as_ref(),
                SQUADS_SEED_SPENDING_LIMIT,
                dao.as_ref(),
            ],
            &SQUADS_PROGRAM_ID,
        )
        .0
}

pub fn get_conditional_token_mint_pda(
    trident: &mut Trident,
    conditional_vault: Pubkey,
    index: u8,
) -> Pubkey {
    trident
        .find_program_address(
            &[
                CONDITIONAL_TOKEN_SEED_PREFIX,
                conditional_vault.as_ref(),
                &[index],
            ],
            &conditional_vault::program_id(),
        )
        .0
}

pub fn get_stake_account_pda(trident: &mut Trident, proposal: Pubkey, staker: Pubkey) -> Pubkey {
    trident
        .find_program_address(
            &[STAKE_SEED_PREFIX, proposal.as_ref(), staker.as_ref()],
            &futarchy::program_id(),
        )
        .0
}

pub fn get_amm_position_pda(
    trident: &mut Trident,
    dao: Pubkey,
    position_authority: Pubkey,
) -> Pubkey {
    trident
        .find_program_address(
            &[
                AMM_POSITION_SEED_PREFIX,
                dao.as_ref(),
                position_authority.as_ref(),
            ],
            &futarchy::program_id(),
        )
        .0
}
