"""Wrapper for ``admin_enqueue_multisig_proposal_approval``."""

from __future__ import annotations

from wake_sol import random

from .base import InstructionWrapper
from ..pytypes.futarchy import (
    EnqueuedMultisigProposalApproval,
    Futarchy as FutarchyProgram,
)
from ..utils.builders import token_transfer_instruction


class AdminEnqueueMultisigProposalApprovalInstruction(InstructionWrapper):
    """Check the admin/liquidator gate and canonical temporary PDA contents."""

    def new_transaction(self, purpose: str):
        context = self.context
        recipient = random.choice(context.actors)
        amount = min(1, context.council_quote_balance())
        payload = token_transfer_instruction(
            context.council_quote_account,
            context.quote_atas_by_owner[recipient.pubkey],
            context.council,
            amount,
        )
        return context.squads.prepare(
            payload,
            purpose=purpose,
            allow_admin_execute=True,
        )

    def can_happy(self) -> bool:
        return self.context.is_spot()

    def happy(self) -> None:
        """Enqueue a fresh active Squads proposal with the current authority."""
        context = self.context
        prepared = self.new_transaction("enqueue approval flow")
        admin = context.enqueue_authority()
        instruction, enqueued = context.squads.build_enqueue(prepared, admin)
        assert not enqueued.exists
        admin.tx(instruction)
        decoded = EnqueuedMultisigProposalApproval.decode(enqueued.data)
        assert decoded.dao == context.dao.pubkey
        assert decoded.transactionIndex == prepared.index
        prepared.enqueued_approval = enqueued

    def can_unhappy(self) -> bool:
        return True

    def unhappy(self) -> None:
        """Reject an enqueue in Futarchy state or with invalid authority/state."""
        context = self.context
        prepared = self.new_transaction("invalid enqueue flow")
        if not context.is_spot():
            admin = context.ops_admin
            expected = FutarchyProgram.PoolNotInSpotState
        elif context.is_liquidated():
            admin = context.ops_admin
            expected = FutarchyProgram.InvalidLiquidator
        else:
            context.squads.approve_for_dependency(prepared)
            admin = context.ops_admin
            expected = FutarchyProgram.InvalidSquadsProposalStatus
        instruction, _ = context.squads.build_enqueue(prepared, admin)
        self.assert_fails_atomically(admin, instruction, expected)
