"""Canonical PDA derivations used by the Futarchy lifecycle."""

from __future__ import annotations

from wake_sol import Account, Pubkey

from ..constants import (
    AMM_POSITION_SEED,
    CONDITIONAL_TOKEN_SEED,
    CONDITIONAL_VAULT_SEED,
    DAO_SEED,
    ENQUEUED_APPROVAL_SEED,
    ENQUEUED_CANCELLATION_SEED,
    EVENT_AUTHORITY_SEED,
    PROPOSAL_SEED,
    QUESTION_SEED,
    SQUADS_MULTISIG_SEED,
    SQUADS_PREFIX_SEED,
    SQUADS_PROPOSAL_SEED,
    SQUADS_SPENDING_LIMIT_SEED,
    SQUADS_TRANSACTION_SEED,
    SQUADS_VAULT_SEED,
    STAKE_SEED,
)


def derive_event_authority(program_id: Pubkey) -> tuple[Account, int]:
    """Derive Anchor's event-CPI authority for one program."""
    return Account.find_program_address([EVENT_AUTHORITY_SEED], program_id)


def derive_dao(
    creator: Account, nonce: int, program_id: Pubkey
) -> tuple[Account, int]:
    """Derive a DAO PDA using its little-endian u64 nonce."""
    return Account.find_program_address(
        [DAO_SEED, creator, nonce.to_bytes(8, "little")], program_id
    )


def derive_amm_position(
    dao: Account, authority: Account, program_id: Pubkey
) -> tuple[Account, int]:
    """Derive the immutable-authority AMM position PDA."""
    return Account.find_program_address(
        [AMM_POSITION_SEED, dao, authority], program_id
    )


def derive_proposal(
    squads_proposal: Account, program_id: Pubkey
) -> tuple[Account, int]:
    """Derive a proposal PDA from its otherwise opaque Squads proposal key."""
    return Account.find_program_address(
        [PROPOSAL_SEED, squads_proposal], program_id
    )


def derive_stake_account(
    proposal: Account, staker: Account, program_id: Pubkey
) -> tuple[Account, int]:
    """Derive the per-proposal, per-staker stake record PDA."""
    return Account.find_program_address(
        [STAKE_SEED, proposal, staker], program_id
    )


def derive_enqueued_approval(
    dao: Account | Pubkey,
    transaction_index: int,
    program_id: Pubkey,
) -> tuple[Account, int]:
    """Derive Futarchy's temporary authorization for a Squads proposal."""
    return Account.find_program_address(
        [
            ENQUEUED_APPROVAL_SEED,
            dao,
            transaction_index.to_bytes(8, "little"),
        ],
        program_id,
    )


def derive_enqueued_cancellation(
    dao: Account | Pubkey,
    transaction_index: int,
    program_id: Pubkey,
) -> tuple[Account, int]:
    """Derive Futarchy's temporary authorization for Squads cancellation."""
    return Account.find_program_address(
        [
            ENQUEUED_CANCELLATION_SEED,
            dao,
            transaction_index.to_bytes(8, "little"),
        ],
        program_id,
    )


def derive_squads_multisig(
    create_key: Account | Pubkey,
    program_id: Pubkey,
) -> tuple[Account, int]:
    """Derive the Squads multisig created with a DAO as its create key."""
    return Account.find_program_address(
        [SQUADS_PREFIX_SEED, SQUADS_MULTISIG_SEED, create_key],
        program_id,
    )


def derive_squads_vault(
    multisig: Account | Pubkey,
    program_id: Pubkey,
    index: int = 0,
) -> tuple[Account, int]:
    """Derive one Squads vault authority by its u8 vault index."""
    return Account.find_program_address(
        [SQUADS_PREFIX_SEED, multisig, SQUADS_VAULT_SEED, bytes([index])],
        program_id,
    )


def derive_squads_transaction(
    multisig: Account | Pubkey,
    transaction_index: int,
    program_id: Pubkey,
) -> tuple[Account, int]:
    """Derive a Squads vault-transaction PDA."""
    return Account.find_program_address(
        [
            SQUADS_PREFIX_SEED,
            multisig,
            SQUADS_TRANSACTION_SEED,
            transaction_index.to_bytes(8, "little"),
        ],
        program_id,
    )


def derive_squads_proposal(
    multisig: Account | Pubkey,
    transaction_index: int,
    program_id: Pubkey,
) -> tuple[Account, int]:
    """Derive the proposal attached to a Squads vault transaction."""
    return Account.find_program_address(
        [
            SQUADS_PREFIX_SEED,
            multisig,
            SQUADS_TRANSACTION_SEED,
            transaction_index.to_bytes(8, "little"),
            SQUADS_PROPOSAL_SEED,
        ],
        program_id,
    )


def derive_squads_spending_limit(
    multisig: Account | Pubkey,
    create_key: Account | Pubkey,
    program_id: Pubkey,
) -> tuple[Account, int]:
    """Derive the Squads spending-limit record created by initialize_dao."""
    return Account.find_program_address(
        [
            SQUADS_PREFIX_SEED,
            multisig,
            SQUADS_SPENDING_LIMIT_SEED,
            create_key,
        ],
        program_id,
    )


def derive_question(
    question_id: bytes,
    oracle: Account | Pubkey,
    outcomes: int,
    program_id: Pubkey,
) -> tuple[Account, int]:
    """Derive a Conditional Vault question PDA."""
    if len(question_id) != 32:
        raise ValueError("question_id must contain exactly 32 bytes")
    return Account.find_program_address(
        [QUESTION_SEED, question_id, oracle, bytes([outcomes])],
        program_id,
    )


def derive_conditional_vault(
    question: Account | Pubkey,
    underlying_mint: Account | Pubkey,
    program_id: Pubkey,
) -> tuple[Account, int]:
    """Derive a Conditional Vault for one question and underlying mint."""
    return Account.find_program_address(
        [CONDITIONAL_VAULT_SEED, question, underlying_mint],
        program_id,
    )


def derive_conditional_mint(
    vault: Account | Pubkey,
    outcome: int,
    program_id: Pubkey,
) -> tuple[Account, int]:
    """Derive one outcome mint created by a Conditional Vault."""
    return Account.find_program_address(
        [CONDITIONAL_TOKEN_SEED, vault, bytes([outcome])],
        program_id,
    )
