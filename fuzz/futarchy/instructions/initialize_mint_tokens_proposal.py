"""Wrapper for ``initialize_mint_tokens_proposal``."""

from __future__ import annotations

from wake_sol import AnchorError, Instruction, random

from .typed_initialize import TypedInitializeInstruction
from ..pytypes.futarchy import (
    Futarchy as FutarchyProgram,
    InitializeMintTokensProposalArgs,
    ProposalAction,
)
from ..utils.builders import token_mint_to_instruction


class InitializeMintTokensProposalInstruction(TypedInitializeInstruction):
    """Validate direct vault mint authority and the stored mint declaration."""

    kind_name = "mint tokens"

    def happy_args(self) -> InitializeMintTokensProposalArgs:
        recipient = random.choice(self.context.actors)
        return InitializeMintTokensProposalArgs(
            amount=random.choice((1, 1_000_000, 1_000_000_000)),
            recipient=recipient.pubkey,
        )

    def payload(self, args, accounts) -> tuple[Instruction, ...]:
        context = self.context
        recipient = context.ensure_underlying_ata(args.recipient, context.base_mint)
        return (
            token_mint_to_instruction(
                context.base_mint,
                recipient,
                context.council,
                args.amount,
            ),
        )

    def build_instruction(self, args, accounts, **overrides):
        base_mint = overrides.get("base_mint", self.context.base_mint)
        return FutarchyProgram.initializeMintTokensProposal(
            args,
            **self.common_accounts(accounts),
            baseMint=base_mint,
            mintGovernor=None,
            mintAuthority=None,
        )

    def assert_action(self, action, args) -> None:
        assert isinstance(action, ProposalAction.MintTokens)
        assert action.amount == args.amount
        assert action.recipient == args.recipient

    def unhappy_case(self):
        args = self.happy_args()
        return (
            args,
            AnchorError.ConstraintAddress,
            2,
            {"base_mint": self.context.quote_mint},
        )
