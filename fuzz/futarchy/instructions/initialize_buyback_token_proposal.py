"""Wrapper for ``initialize_buyback_token_proposal``."""

from __future__ import annotations

from wake_sol import Instruction, random

from .typed_initialize import TypedInitializeInstruction
from ..constants import (
    MAX_BUYBACK_CYCLE_SECONDS,
    MAX_BUYBACK_START_DELAY_SECONDS,
    MIN_BUYBACK_CYCLE_COUNT,
    MIN_BUYBACK_CYCLE_SECONDS,
    U64_MAX,
)
from ..pytypes.futarchy import (
    Futarchy as FutarchyProgram,
    InitializeBuybackTokenProposalArgs,
    ProposalAction,
)
from ..utils.builders import memo_instruction


class InitializeBuybackTokenProposalInstruction(TypedInitializeInstruction):
    """Validate venue bounds and preserve the exact buyback declaration."""

    kind_name = "buyback token"

    def happy_args(self) -> InitializeBuybackTokenProposalArgs:
        context = self.context
        cash_cap = context.council_quote_balance() // 4
        total_cap = (
            context.instructions.launch_proposal.treasury_quote_value() // 4
            if context.is_spot()
            else cash_cap
        )
        amounts = [
            max(1, min(U64_MAX, cap + offset))
            for cap in (cash_cap, total_cap)
            for offset in (-1, 0, 1)
        ]
        amounts.append(random.randint(1, max(1, min(U64_MAX, total_cap))))
        return InitializeBuybackTokenProposalArgs(
            quoteAmount=random.choice(amounts),
            cycleCount=random.choice((MIN_BUYBACK_CYCLE_COUNT, 3, 10)),
            cycleFrequencySeconds=random.choice(
                (
                    MIN_BUYBACK_CYCLE_SECONDS,
                    3_600,
                    86_400,
                    MAX_BUYBACK_CYCLE_SECONDS,
                )
            ),
            startDelaySeconds=random.choice(
                (0, 60, 86_400, MAX_BUYBACK_START_DELAY_SECONDS)
            ),
            minPrice=random.choice((None, 1_000_000)),
            maxPrice=random.choice((None, 2_000_000)),
        )

    def payload(self, args, accounts) -> tuple[Instruction, ...]:
        def price(value):
            return "none" if value is None else str(value)

        return (
            memo_instruction(
                "metadao-buyback/1 "
                f"proposal={accounts.proposal.pubkey} "
                f"spend={args.quoteAmount} "
                f"cycles={args.cycleCount} "
                f"cycle_seconds={args.cycleFrequencySeconds} "
                f"start_delay={args.startDelaySeconds} "
                f"min_price={price(args.minPrice)} "
                f"max_price={price(args.maxPrice)}"
            ),
        )

    def build_instruction(self, args, accounts, **overrides):
        return FutarchyProgram.initializeBuybackTokenProposal(
            args, **self.common_accounts(accounts)
        )

    def assert_action(self, action, args) -> None:
        assert isinstance(action, ProposalAction.BuybackToken)
        assert action.quoteAmount == args.quoteAmount
        assert action.cycleCount == args.cycleCount
        assert action.cycleFrequencySeconds == args.cycleFrequencySeconds
        assert action.startDelaySeconds == args.startDelaySeconds
        assert action.minPrice == args.minPrice
        assert action.maxPrice == args.maxPrice

    def unhappy_case(self):
        choice = random.randint(0, 4)
        args = self.happy_args()
        if choice == 0:
            args.quoteAmount = 0
            expected = FutarchyProgram.InvalidBuybackAmount
        elif choice == 1:
            args.cycleCount = random.choice((0, MIN_BUYBACK_CYCLE_COUNT - 1))
            expected = FutarchyProgram.InvalidBuybackCycleCount
        elif choice == 2:
            args.cycleFrequencySeconds = MIN_BUYBACK_CYCLE_SECONDS - 1
            expected = FutarchyProgram.InvalidBuybackCycleFrequency
        elif choice == 3:
            args.startDelaySeconds = MAX_BUYBACK_START_DELAY_SECONDS + 1
            expected = FutarchyProgram.InvalidBuybackStartDelay
        else:
            args.minPrice = 2
            args.maxPrice = 1
            expected = FutarchyProgram.InvalidBuybackPriceBand
        return args, expected, 2, {}
