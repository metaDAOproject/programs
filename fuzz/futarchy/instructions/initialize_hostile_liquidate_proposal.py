"""Wrapper for ``initialize_hostile_liquidate_proposal``."""

from __future__ import annotations

from wake_sol import Instruction, random

from .typed_initialize import TypedInitializeInstruction
from ..pytypes.futarchy import (
    Futarchy as FutarchyProgram,
    InitializeHostileLiquidateProposalArgs,
    ProposalAction,
)
from ..utils.builders import memo_instruction


class InitializeHostileLiquidateProposalInstruction(
    TypedInitializeInstruction
):
    """Check the declared liquidator and independently reconstructed payload."""

    kind_name = "hostile liquidation"

    def happy_args(self) -> InitializeHostileLiquidateProposalArgs:
        return InitializeHostileLiquidateProposalArgs(
            liquidator=random.choice(self.context.liquidator_candidates).pubkey
        )

    def payload(self, args, accounts) -> tuple[Instruction, ...]:
        context = self.context
        accounts.liquidator = context.signers_by_pubkey[args.liquidator]
        memo = memo_instruction(
            "Intellectual property transferred to the DAO upon initialization "
            "will be transferred back to the original team."
        )
        return (memo,)

    def build_instruction(self, args, accounts, **overrides):
        return FutarchyProgram.initializeHostileLiquidateProposal(
            args, **self.common_accounts(accounts)
        )

    def assert_action(self, action, args) -> None:
        assert isinstance(action, ProposalAction.HostileLiquidate)
        assert action.liquidator == args.liquidator

    def unhappy_case(self):
        return self.happy_args(), FutarchyProgram.QuestionMustBeBinary, 3, {}
