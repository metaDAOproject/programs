"""Wrapper for ``initialize_large_spend_proposal``."""

from __future__ import annotations

from wake_sol import Instruction

from .typed_initialize import TypedInitializeInstruction
from ..constants import U64_MAX
from ..pytypes.futarchy import (
    Futarchy as FutarchyProgram,
    InitializeLargeSpendProposalArgs,
    ProposalAction,
)
from ..utils.builders import token_transfer_instruction
from ..utils.state import ProposalAccounts


class InitializeLargeSpendProposalInstruction(TypedInitializeInstruction):
    """Validate the spend cap and the stored vault-transfer declaration."""

    kind_name = "large spend"

    def happy_args(self) -> InitializeLargeSpendProposalArgs:
        limit = self.context.dao_state().initialSpendingLimit
        assert limit is not None
        return InitializeLargeSpendProposalArgs(
            amount=max(1, min(limit.amountPerMonth * 3, 10_000_000_000))
        )

    def payload(
        self, args: InitializeLargeSpendProposalArgs, accounts: ProposalAccounts
    ) -> tuple[Instruction, ...]:
        context = self.context
        team = self.context.dao_state().teamAddress
        destination = context.ensure_underlying_ata(team, context.quote_mint)
        return (
            token_transfer_instruction(
                context.council_quote_account,
                destination,
                context.council,
                args.amount,
            ),
        )

    def build_instruction(self, args, accounts, **overrides):
        return FutarchyProgram.initializeLargeSpendProposal(
            args, **self.common_accounts(accounts)
        )

    def assert_action(self, action, args) -> None:
        assert isinstance(action, ProposalAction.LargeSpend)
        assert action.amount == args.amount
        assert action.teamAddress == self.context.dao_state().teamAddress

    def unhappy_case(self):
        limit = self.context.dao_state().initialSpendingLimit
        if limit is None:
            amount = 1
            expected = FutarchyProgram.NoSpendingLimit
        else:
            amount = limit.amountPerMonth * 3 + 1
            assert amount <= U64_MAX
            expected = FutarchyProgram.SpendCapExceeded
        args = InitializeLargeSpendProposalArgs(amount=amount)
        return args, expected, 2, {}

    def can_happy(self) -> bool:
        return (
            super().can_happy()
            and self.context.dao_state().initialSpendingLimit is not None
        )

    def can_unhappy(self) -> bool:
        if not super().can_unhappy():
            return False
        limit = self.context.dao_state().initialSpendingLimit
        return (
            limit is None
            or limit.amountPerMonth <= (U64_MAX - 1) // 3
        )
