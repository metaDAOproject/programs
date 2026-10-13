"""Wrapper for ``initialize_spending_limit_change_proposal``."""

from __future__ import annotations

from wake_sol import Instruction, random

from .typed_initialize import TypedInitializeInstruction
from ..pytypes.futarchy import (
    Futarchy as FutarchyProgram,
    InitialSpendingLimit,
    InitializeSpendingLimitChangeProposalArgs,
    ProposalAction,
)
from ..utils.parameters import (
    invalid_spending_limit,
    valid_spending_limit,
)


class InitializeSpendingLimitChangeProposalInstruction(
    TypedInitializeInstruction
):
    """Check bounded members and the exact set/remove declaration."""

    kind_name = "spending limit change"

    def happy_args(self) -> InitializeSpendingLimitChangeProposalArgs:
        has_limit = self.context.dao_state().initialSpendingLimit is not None
        if has_limit and random.choice((False, True)):
            config = None
        else:
            config = valid_spending_limit(self.context.member_candidates)
        return InitializeSpendingLimitChangeProposalArgs(config=config)

    def payload(self, args, accounts) -> tuple[Instruction, ...]:
        instruction = FutarchyProgram.setSpendingLimit(
            self.context.instructions.set_spending_limit.build_args(args.config),
            dao=self.context.dao,
            squadsMultisigVault=self.context.council,
            eventAuthority=self.context.event_authority,
            program=self.context.program_id,
        )
        return (instruction,)

    def build_instruction(self, args, accounts, **overrides):
        return FutarchyProgram.initializeSpendingLimitChangeProposal(
            args, **self.common_accounts(accounts)
        )

    def assert_action(self, action, args) -> None:
        assert isinstance(action, ProposalAction.SpendingLimitChange)
        assert action.config == args.config

    def unhappy_case(self):
        config, error_name = invalid_spending_limit(
            self.context.member_candidates
        )
        return (
            InitializeSpendingLimitChangeProposalArgs(config=config),
            getattr(FutarchyProgram, error_name),
            2,
            {},
        )
