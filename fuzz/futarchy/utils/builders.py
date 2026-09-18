"""Small builders for external instructions embedded in Squads payloads."""

from __future__ import annotations

from wake_sol import Account, Instruction, Pubkey, signer, svm, writable

from ..constants import SPL_MEMO_PROGRAM_ID


def memo_instruction(message: str) -> Instruction:
    """Build an SPL Memo instruction with no required signers."""
    return Instruction(SPL_MEMO_PROGRAM_ID, [], message.encode())


def token_transfer_instruction(
    source: Account,
    destination: Account,
    authority: Account | Pubkey,
    amount: int,
) -> Instruction:
    """Build a classic SPL Token ``Transfer`` instruction."""
    return Instruction(
        svm.token.program_id,
        [writable(source), writable(destination), signer(authority)],
        bytes([3]) + amount.to_bytes(8, "little"),
    )


def token_mint_to_instruction(
    mint: Account,
    destination: Account,
    authority: Account | Pubkey,
    amount: int,
) -> Instruction:
    """Build a classic SPL Token ``MintTo`` instruction."""
    return Instruction(
        svm.token.program_id,
        [writable(mint), writable(destination), signer(authority)],
        bytes([7]) + amount.to_bytes(8, "little"),
    )
