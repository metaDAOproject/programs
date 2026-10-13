"""Wrapper for ``execute_multisig_proposal_approval``."""

from __future__ import annotations

from wake_sol import AnchorError, random

from .base import InstructionWrapper
from ..constants import SQUADS_PROGRAM_ID
from ..pytypes.futarchy import Futarchy as FutarchyProgram
from ..utils.builders import memo_instruction


class ExecuteMultisigProposalApprovalInstruction(InstructionWrapper):
    """Check permissionless voting and closure of the one-shot authorization."""

    def queued(self):
        return [
            transaction
            for transaction in self.context.squads_transactions
            if transaction.enqueued_approval is not None
            and transaction.enqueued_approval.exists
            and not transaction.approved
        ]

    def build_instruction(self, prepared, *, proposal=None):
        context = self.context
        assert prepared.enqueued_approval is not None
        if proposal is not None:
            return self._with_proposal(prepared, proposal)
        return context.squads.build_approve(
            prepared,
            prepared.enqueued_approval,
            context.payer,
        )

    def _with_proposal(self, prepared, proposal):
        context = self.context
        return FutarchyProgram.executeMultisigProposalApproval(
            dao=context.dao,
            rentReceiver=context.payer,
            squadsMultisig=context.squads_multisig,
            squadsMultisigProposal=proposal,
            enqueuedApproval=prepared.enqueued_approval,
            squadsMultisigProgram=SQUADS_PROGRAM_ID,
        )

    def can_happy(self) -> bool:
        return self.context.is_spot() and bool(self.queued())

    def happy(self) -> None:
        """Approve an enqueued Squads proposal and close its authorization PDA."""
        context = self.context
        prepared = random.choice(self.queued())
        enqueued = prepared.enqueued_approval
        proposal_before = bytes(prepared.proposal.data)
        context.payer.tx(self.build_instruction(prepared))
        assert enqueued is not None and not enqueued.exists
        assert bytes(prepared.proposal.data) != proposal_before
        context.squads.assert_proposal_status(prepared, "Approved")
        prepared.enqueued_approval = None
        prepared.approved = True

    def can_unhappy(self) -> bool:
        return self.context.is_spot()

    def unhappy(self) -> None:
        """Reject a Squads proposal PDA that does not match the enqueued index."""
        context = self.context
        first = context.squads.prepare(
            memo_instruction("approval seeds A"), purpose="approval seeds A"
        )
        second = context.squads.prepare(
            memo_instruction("approval seeds B"), purpose="approval seeds B"
        )
        admin = context.enqueue_authority()
        enqueue, enqueued = context.squads.build_enqueue(first, admin)
        admin.tx(enqueue)
        first.enqueued_approval = enqueued
        instruction = self.build_instruction(first, proposal=second.proposal)
        self.assert_fails_atomically(
            context.payer,
            instruction,
            AnchorError.ConstraintSeeds,
        )
