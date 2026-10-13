"""Snapshot-checked wrapper for Futarchy ``spot_swap``."""

from __future__ import annotations

from wake_sol import Account, AnchorError, random, svm

from .base import InstructionWrapper
from ..constants import FUTARCHY_PROGRAM_ID, MAX_BPS, U64_MAX
from ..pytypes.futarchy import (
    Futarchy as FutarchyProgram,
    Market,
    PoolState,
    SpotSwapParams,
    SwapType,
)
from ..utils.swaps import PROTOCOL_TAKER_FEE_BPS, assert_swap_transition
from ..utils.tokens import token_balance


class SpotSwapInstruction(InstructionWrapper):
    """Check exact user/vault transfers and AMM reserve-product monotonicity."""

    @staticmethod
    def build_params(
        direction: SwapType, amount: int, minimum_output: int = 0
    ) -> SpotSwapParams:
        return SpotSwapParams(
            inputAmount=amount,
            swapType=direction,
            minOutputAmount=minimum_output,
        )

    def build_instruction(self, user: Account, params: SpotSwapParams):
        context = self.context
        return FutarchyProgram.spotSwap(
            params,
            dao=context.dao,
            userBaseAccount=context.base_atas_by_owner[user.pubkey],
            userQuoteAccount=context.quote_atas_by_owner[user.pubkey],
            ammBaseVault=context.amm_base_vault,
            ammQuoteVault=context.amm_quote_vault,
            user=user,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def can_happy(self) -> bool:
        context = self.context
        if not context.pool_has_liquidity():
            return False
        return (
            not context.hostile_liquidation_market_active()
            and bool(self.funded_trades())
        )

    def funded_trades(self) -> list[tuple[Account, SwapType]]:
        """Return user/direction pairs with a positive input balance."""
        context = self.context
        return [
            (user, direction)
            for user in context.actors
            for direction in (SwapType.Buy, SwapType.Sell)
            if token_balance(
                context.quote_atas_by_owner[user.pubkey]
                if direction == SwapType.Buy
                else context.base_atas_by_owner[user.pubkey]
            )
            > 0
        ]

    def happy(self) -> None:
        """Swap in either direction and infer/check output from token deltas."""
        context = self.context
        user, direction = random.choice(self.funded_trades())
        input_account = (
            context.quote_atas_by_owner[user.pubkey]
            if direction == SwapType.Buy
            else context.base_atas_by_owner[user.pubkey]
        )
        output_account = (
            context.base_atas_by_owner[user.pubkey]
            if direction == SwapType.Buy
            else context.quote_atas_by_owner[user.pubkey]
        )
        amm_input = (
            context.amm_quote_vault
            if direction == SwapType.Buy
            else context.amm_base_vault
        )
        amm_output = (
            context.amm_base_vault
            if direction == SwapType.Buy
            else context.amm_quote_vault
        )
        amount = random.randint(
            1, min(token_balance(input_account), 100_000_000)
        )
        params = self.build_params(direction, amount)
        instruction = self.build_instruction(user, params)
        tracked = (
            context.dao,
            input_account,
            output_account,
            amm_input,
            amm_output,
        )
        before_dao = context.dao_state()
        timestamp = svm.clock.unix_timestamp
        before = self.snapshot(instruction, extra_accounts=tracked)
        user.tx(self.compute_unit_limit(), instruction)
        after_dao = context.dao_state()
        assert token_balance(input_account) == (
            before.account(input_account).token_balance() - amount
        )
        assert token_balance(amm_input) == (
            before.account(amm_input).token_balance() + amount
        )
        output = token_balance(output_account) - before.account(
            output_account
        ).token_balance()
        assert output >= params.minOutputAmount
        assert token_balance(amm_output) == (
            before.account(amm_output).token_balance() - output
        )
        assert_swap_transition(
            before_dao, after_dao, Market.Spot, direction, amount, output, timestamp
        )

        if isinstance(before_dao.amm.state, PoolState.Spot):
            assert isinstance(after_dao.amm.state, PoolState.Spot)
            old = before_dao.amm.state.spot
            new = after_dao.amm.state.spot
            net_input = (
                amount * (MAX_BPS - PROTOCOL_TAKER_FEE_BPS) // MAX_BPS
            )
            protocol_fee = amount - net_input
            if direction == SwapType.Buy:
                expected_output = (
                    net_input * old.baseReserves
                    // (old.quoteReserves + net_input)
                )
                assert new.quoteReserves == old.quoteReserves + net_input
                assert new.baseReserves == old.baseReserves - expected_output
                assert new.quoteProtocolFeeBalance == (
                    old.quoteProtocolFeeBalance + protocol_fee
                )
                assert (
                    new.baseProtocolFeeBalance
                    == old.baseProtocolFeeBalance
                )
            else:
                expected_output = (
                    net_input * old.quoteReserves
                    // (old.baseReserves + net_input)
                )
                assert new.baseReserves == old.baseReserves + net_input
                assert new.quoteReserves == old.quoteReserves - expected_output
                assert new.baseProtocolFeeBalance == (
                    old.baseProtocolFeeBalance + protocol_fee
                )
                assert (
                    new.quoteProtocolFeeBalance
                    == old.quoteProtocolFeeBalance
                )
            assert output == expected_output

    def can_unhappy(self) -> bool:
        return self.context.pool_has_liquidity()

    def unhappy(self) -> None:
        """Reject insufficient input or positive impossible slippage."""
        context = self.context
        user = random.choice(context.actors)
        direction = random.choice((SwapType.Buy, SwapType.Sell))
        input_account = (
            context.quote_atas_by_owner[user.pubkey]
            if direction == SwapType.Buy
            else context.base_atas_by_owner[user.pubkey]
        )
        if random.choice((False, True)):
            params = self.build_params(
                direction, token_balance(input_account) + 1
            )
            expected = FutarchyProgram.InsufficientBalance
        else:
            funded = self.funded_trades()
            if not funded:
                params = self.build_params(
                    direction, token_balance(input_account) + 1
                )
                expected = FutarchyProgram.InsufficientBalance
            else:
                user, direction = random.choice(funded)
                input_account = (
                    context.quote_atas_by_owner[user.pubkey]
                    if direction == SwapType.Buy
                    else context.base_atas_by_owner[user.pubkey]
                )
                params = self.build_params(
                    direction,
                    random.randint(
                        1, min(token_balance(input_account), 100_000_000)
                    ),
                    U64_MAX,
                )
                expected = AnchorError.RequireGteViolated
        instruction = self.build_instruction(user, params)
        self.assert_fails_atomically(
            user,
            instruction,
            expected,
            before=(self.compute_unit_limit(),),
        )
