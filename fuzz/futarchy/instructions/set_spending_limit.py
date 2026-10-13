"""Snapshot wrapper for vault-signed Futarchy ``set_spending_limit``."""

from __future__ import annotations

from wake_sol import random

from .base import InstructionWrapper
from ..constants import FUTARCHY_PROGRAM_ID
from ..pytypes.futarchy import (
    Futarchy as FutarchyProgram,
    InitialSpendingLimit,
    SetSpendingLimitArgs,
)
from ..utils.parameters import (
    invalid_spending_limit,
    valid_spending_limit,
)
from ..utils.assertions import assert_changed_only


class SetSpendingLimitInstruction(InstructionWrapper):
    """Check exact authoritative config replacement and dirty-flag behavior."""

    @staticmethod
    def build_args(
        config: InitialSpendingLimit | None,
    ) -> SetSpendingLimitArgs:
        return SetSpendingLimitArgs(config=config)

    def build_instruction(self, args: SetSpendingLimitArgs):
        context = self.context
        return FutarchyProgram.setSpendingLimit(
            args,
            dao=context.dao,
            squadsMultisigVault=context.council,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def can_happy(self) -> bool:
        return not self.context.is_liquidated() and self.context.is_spot()

    def happy(self) -> None:
        """Set or remove the desired Squads limit through normal execution."""
        context = self.context
        config = (
            None
            if context.dao_state().initialSpendingLimit is not None
            and random.choice((False, True))
            else valid_spending_limit(context.member_candidates)
        )
        args = self.build_args(config)
        inner = self.build_instruction(args)
        prepared = context.squads.prepare_and_approve(
            inner, purpose="set spending limit"
        )
        before = context.dao_state()
        spending_limit_existed = context.squads_spending_limit.exists
        spending_limit_before = (
            bytes(context.squads_spending_limit.data)
            if spending_limit_existed
            else None
        )
        context.squads.execute_top_level(prepared)
        after = context.dao_state()
        assert_changed_only(
            before, after, seqNum=before.seqNum + 1,
            initialSpendingLimit=config, spendingLimitDirty=True,
        )
        assert context.squads_spending_limit.exists == spending_limit_existed
        if spending_limit_existed:
            assert bytes(context.squads_spending_limit.data) == spending_limit_before

    def can_unhappy(self) -> bool:
        return not self.context.is_liquidated() and self.context.is_spot()

    def unhappy(self) -> None:
        """Reject more than ten spending-limit members and prove rollback."""
        context = self.context
        config, error_name = invalid_spending_limit(context.member_candidates)
        inner = self.build_instruction(self.build_args(config))
        prepared = context.squads.prepare_and_approve(
            inner, purpose="invalid spending limit"
        )
        execute = context.squads.build_execute(prepared)
        self.assert_fails_atomically(
            context.payer,
            execute,
            getattr(FutarchyProgram, error_name),
            before=(context.squads.compute_unit_limit(),),
            signers=(context.permissionless_account,),
            extra_accounts=(context.dao,),
        )
        prepared.disabled = True
