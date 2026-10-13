"""Support wrapper for ordinary top-level execution of approved Squads payloads."""

from __future__ import annotations

from wake_sol import random

from .base import InstructionWrapper
from ..utils.payloads import assert_payload_effects, payload_state_allows_execution


class ExecutePassedPayloadInstruction(InstructionWrapper):
    """Exercise proposal payloads without re-entering Futarchy through admin CPI."""

    def candidates(self):
        passed_transaction_keys = {
            proposal.squads.transaction.pubkey
            for proposal in self.context.passed_proposals()
        }
        return [
            transaction
            for transaction in self.context.squads_transactions
            if transaction.approved
            and not transaction.executed
            and not transaction.cancelled
            and not transaction.disabled
            and (
                transaction.transaction.pubkey in passed_transaction_keys
                or transaction.allow_admin_execute
            )
            and payload_state_allows_execution(self.context, transaction)
        ]

    def can_happy(self) -> bool:
        return bool(self.candidates())

    def happy(self) -> None:
        """Execute a passed proposal or estate transaction directly in Squads."""
        context = self.context
        prepared = random.choice(self.candidates())
        before = self.snapshot(
            *prepared.instructions,
            extra_accounts=(context.dao, context.base_mint, context.quote_mint),
        )
        context.squads.assert_proposal_status(prepared, "Approved")
        context.squads.execute_top_level(prepared)
        assert_payload_effects(context, prepared, before)
