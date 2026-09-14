"""Wrapper for ``execute_multisig_proposal_cancellation``."""

from __future__ import annotations

from wake_sol import AnchorError, random

from .base import InstructionWrapper
from ..constants import FUTARCHY_PROGRAM_ID, SQUADS_INVALID_PROPOSAL_STATUS_ERROR_CODE
from ..utils.accounts import derive_enqueued_cancellation
from ..utils.builders import memo_instruction


class ExecuteMultisigProposalCancellationInstruction(InstructionWrapper):
    """Check permissionless cancellation and one-shot PDA closure."""

    def queued(self):
        return [
            transaction
            for transaction in self.context.squads_transactions
            if transaction.enqueued_cancellation is not None
            and transaction.enqueued_cancellation.exists
            and not transaction.executed
            and not transaction.cancelled
        ]

    def can_happy(self) -> bool:
        return bool(self.queued())

    def happy(self) -> None:
        """Cancel an Approved proposal and close its authorization PDA."""
        context = self.context
        prepared = random.choice(self.queued())
        enqueued = prepared.enqueued_cancellation
        assert enqueued is not None
        proposal_before = bytes(prepared.proposal.data)
        context.payer.tx(
            context.squads.build_cancel(prepared, enqueued, context.payer)
        )
        assert not enqueued.exists
        assert bytes(prepared.proposal.data) != proposal_before
        context.squads.assert_proposal_status(prepared, "Cancelled")
        prepared.enqueued_cancellation = None
        prepared.cancelled = True
        self.assert_fails_atomically(
            context.payer, context.squads.build_execute(prepared),
            SQUADS_INVALID_PROPOSAL_STATUS_ERROR_CODE,
            before=(self.compute_unit_limit(),),
            signers=(context.permissionless_account,),
        )
        context.squads.assert_proposal_status(prepared, "Cancelled")

    def can_unhappy(self) -> bool:
        return self.context.is_spot()

    def unhappy(self) -> None:
        """Reject execution when no cancellation authorization exists."""
        context = self.context
        prepared = context.squads.prepare_and_approve(
            memo_instruction("missing cancellation authorization"),
            purpose="invalid cancellation execution",
        )
        enqueued, _ = derive_enqueued_cancellation(
            context.dao, prepared.index, FUTARCHY_PROGRAM_ID
        )
        instruction = context.squads.build_cancel(
            prepared, enqueued, context.payer
        )
        self.assert_fails_atomically(
            context.payer,
            instruction,
            AnchorError.AccountNotInitialized,
        )
