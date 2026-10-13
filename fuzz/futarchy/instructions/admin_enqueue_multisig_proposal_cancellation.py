"""Wrapper for ``admin_enqueue_multisig_proposal_cancellation``."""

from __future__ import annotations

from wake_sol import random

from .base import InstructionWrapper
from ..pytypes.futarchy import (
    EnqueuedMultisigProposalCancellation,
    Futarchy as FutarchyProgram,
)
from ..utils.builders import memo_instruction


class AdminEnqueueMultisigProposalCancellationInstruction(InstructionWrapper):
    """Check the authority gate and canonical one-shot cancellation PDA."""

    def candidates(self):
        return [
            transaction
            for transaction in self.context.squads_transactions
            if transaction.approved
            and not transaction.executed
            and not transaction.cancelled
            and transaction.purpose != "hostile liquidation"
            and (
                transaction.enqueued_cancellation is None
                or not transaction.enqueued_cancellation.exists
            )
        ]

    def can_happy(self) -> bool:
        return bool(self.candidates())

    def happy(self) -> None:
        """Enqueue cancellation of an Approved proposal."""
        context = self.context
        prepared = random.choice(self.candidates())
        context.squads.assert_proposal_status(prepared, "Approved")
        authority = context.enqueue_authority()
        instruction, enqueued = context.squads.build_enqueue_cancellation(
            prepared, authority
        )
        assert not enqueued.exists
        authority.tx(instruction)
        decoded = EnqueuedMultisigProposalCancellation.decode(enqueued.data)
        assert decoded.dao == context.dao.pubkey
        assert decoded.transactionIndex == prepared.index
        prepared.enqueued_cancellation = enqueued

    def can_unhappy(self) -> bool:
        return True

    def unhappy(self) -> None:
        """Reject cancellation enqueue while the proposal is still Active."""
        context = self.context
        prepared = context.squads.prepare(
            memo_instruction("cancellation requires approval"),
            purpose="invalid cancellation enqueue",
        )
        authority = context.enqueue_authority()
        instruction, _ = context.squads.build_enqueue_cancellation(
            prepared, authority
        )
        self.assert_fails_atomically(
            authority,
            instruction,
            FutarchyProgram.SquadsProposalNotApproved,
        )
