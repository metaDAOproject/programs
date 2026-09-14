"""Snapshot wrapper for Futarchy ``sync_spending_limit``."""

from __future__ import annotations

from .base import InstructionWrapper
from ..constants import FUTARCHY_PROGRAM_ID, SQUADS_PROGRAM_ID
from ..pytypes.futarchy import Futarchy as FutarchyProgram
from ..utils.assertions import assert_changed_only


class SyncSpendingLimitInstruction(InstructionWrapper):
    """Check projection of the DAO record into Squads and dirty consumption."""

    def build_instruction(self):
        context = self.context
        return FutarchyProgram.syncSpendingLimit(
            dao=context.dao,
            squadsMultisig=context.squads_multisig,
            spendingLimit=context.squads_spending_limit,
            rentPayer=context.payer,
            squadsProgram=SQUADS_PROGRAM_ID,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def can_happy(self) -> bool:
        return self.context.dao_state().spendingLimitDirty

    def happy(self) -> None:
        """Recreate/remove Squads state and consume exactly one dirty write."""
        context = self.context
        before = context.dao_state()
        context.payer.tx(self.compute_unit_limit(), self.build_instruction())
        after = context.dao_state()
        assert_changed_only(
            before, after, seqNum=before.seqNum + 1, spendingLimitDirty=False
        )
        should_exist = (
            before.liquidator is None and before.initialSpendingLimit is not None
        )
        assert context.squads_spending_limit.exists == should_exist
        projected_config = before.initialSpendingLimit if should_exist else None
        context.squads.assert_spending_limit(projected_config)

    def can_unhappy(self) -> bool:
        return not self.context.dao_state().spendingLimitDirty

    def unhappy(self) -> None:
        """Reject an ungated monthly-budget reset and prove rollback."""
        instruction = self.build_instruction()
        self.assert_fails_atomically(
            self.context.payer,
            instruction,
            FutarchyProgram.SpendingLimitNotDirty,
            before=(self.compute_unit_limit(),),
        )
