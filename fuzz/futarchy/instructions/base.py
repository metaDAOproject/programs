"""Shared snapshot, execution, and atomic-failure behavior for wrappers."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from wake_sol import Account, Instruction

from ..constants import (
    COMPUTE_BUDGET_PROGRAM_ID,
    TRANSACTION_COMPUTE_UNIT_LIMIT,
)
from ..utils.assertions import (
    AccountSnapshot,
    assert_atomic_failure,
    writable_accounts,
)


class InstructionWrapper:
    """Bind one public instruction to the fuzz context and snapshot checks."""

    def __init__(self, context: Any) -> None:
        self.context = context

    @staticmethod
    def snapshot(
        *instructions: Instruction,
        extra_accounts: Iterable[Account] = (),
    ) -> AccountSnapshot:
        """Snapshot every writable meta plus explicitly relevant accounts."""
        return AccountSnapshot.take(
            writable_accounts(instructions, extra_accounts)
        )

    @staticmethod
    def compute_unit_limit(
        units: int = TRANSACTION_COMPUTE_UNIT_LIMIT,
    ) -> Instruction:
        """Build Solana's SetComputeUnitLimit instruction."""
        return Instruction(
            COMPUTE_BUDGET_PROGRAM_ID,
            [],
            bytes([2]) + units.to_bytes(4, "little"),
        )

    def assert_fails_atomically(
        self,
        signer: Account,
        instruction: Any,
        expected_error: Any,
        *,
        before: tuple[Any, ...] = (),
        signers: tuple[Account, ...] = (),
        extra_accounts: tuple[Account, ...] = (),
    ) -> None:
        """Require the expected error without changing any writable account."""
        instructions = (*before, instruction)
        assert_atomic_failure(
            lambda: signer.tx(
                *before,
                instruction,
                signers=list(signers),
            ),
            expected_error,
            instructions,
            fee_payer=signer,
            extra_accounts=extra_accounts,
        )
