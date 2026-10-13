"""Wrapper for ``admin_execute_multisig_proposal``."""

from __future__ import annotations

from wake_sol import random

from .base import InstructionWrapper
from ..constants import (
    SQUADS_INVALID_PROPOSAL_STATUS_ERROR_CODE,
    SQUADS_PROGRAM_ID,
)
from ..pytypes.futarchy import Futarchy as FutarchyProgram
from ..utils.builders import token_transfer_instruction
from ..utils.payloads import assert_payload_effects


class AdminExecuteMultisigProposalInstruction(InstructionWrapper):
    """Check the administrative Squads execution bridge with an external payload."""

    def prepare(self, purpose: str, *, approve: bool):
        context = self.context
        recipient = random.choice(context.actors)
        destination = context.quote_atas_by_owner[recipient.pubkey]
        amount = min(1, context.council_quote_balance())
        payload = token_transfer_instruction(
            context.council_quote_account,
            destination,
            context.council,
            amount,
        )
        if approve:
            prepared = context.squads.prepare_and_approve(
                payload,
                purpose=purpose,
                allow_admin_execute=True,
            )
        else:
            prepared = context.squads.prepare(
                payload,
                purpose=purpose,
                allow_admin_execute=True,
            )
        return prepared, destination, amount

    def build_instruction(self, prepared, admin=None):
        context = self.context
        return FutarchyProgram.adminExecuteMultisigProposal(
            dao=context.dao,
            admin=admin or context.proposal_admin,
            squadsMultisig=context.squads_multisig,
            squadsMultisigProposal=prepared.proposal,
            squadsMultisigVaultTransaction=prepared.transaction,
            squadsMultisigProgram=SQUADS_PROGRAM_ID,
            remaining_accounts=prepared.message_accounts,
        )

    def can_happy(self) -> bool:
        return (
            self.context.is_spot()
            and self.context.council_quote_balance() > 0
        )

    def happy(self) -> None:
        """Execute an approved external payload and verify its exact token delta."""
        context = self.context
        prepared, _, _ = self.prepare(
            "admin execute happy", approve=True
        )
        context.squads.assert_proposal_status(prepared, "Approved")
        admin = context.proposal_admin
        before = self.snapshot(
            *prepared.instructions,
            extra_accounts=(context.dao, context.base_mint, context.quote_mint),
        )
        admin.tx(
            self.compute_unit_limit(),
            self.build_instruction(prepared, admin),
        )
        context.squads.assert_proposal_status(prepared, "Executed")
        assert_payload_effects(context, prepared, before)
        prepared.executed = True

    def can_unhappy(self) -> bool:
        return self.context.is_spot()

    def unhappy(self) -> None:
        """Reject an Active, unapproved Squads transaction atomically."""
        context = self.context
        prepared, _, _ = self.prepare("admin execute unapproved", approve=False)
        context.squads.assert_proposal_status(prepared, "Active")
        admin = context.proposal_admin
        instruction = self.build_instruction(prepared, admin)
        self.assert_fails_atomically(
            admin,
            instruction,
            SQUADS_INVALID_PROPOSAL_STATUS_ERROR_CODE,
            before=(self.compute_unit_limit(),),
        )
        context.squads.assert_proposal_status(prepared, "Active")
        assert not prepared.executed
