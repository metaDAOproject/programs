"""Snapshot-checked wrapper for Futarchy ``withdraw_liquidity``."""

from __future__ import annotations

from wake_sol import Account, random

from .base import InstructionWrapper
from ..constants import FUTARCHY_PROGRAM_ID, U64_MAX
from ..pytypes.futarchy import (
    AmmPosition,
    Futarchy as FutarchyProgram,
    PoolState,
    WithdrawLiquidityParams,
)
from ..utils.tokens import token_balance
from ..utils.assertions import assert_changed_only


class WithdrawLiquidityInstruction(InstructionWrapper):
    """Check pro-rata payouts while proving protocol fees remain untouched."""

    @staticmethod
    def build_params(
        liquidity: int, minimum_base: int = 0, minimum_quote: int = 0
    ) -> WithdrawLiquidityParams:
        return WithdrawLiquidityParams(
            liquidityToWithdraw=liquidity,
            minBaseAmount=minimum_base,
            minQuoteAmount=minimum_quote,
        )

    def build_instruction(
        self,
        authority: Account,
        position: Account,
        params: WithdrawLiquidityParams,
    ):
        context = self.context
        if authority.pubkey == context.council.pubkey:
            base_account = context.council_base_account
            quote_account = context.council_quote_account
        else:
            base_account = context.base_atas_by_owner[authority.pubkey]
            quote_account = context.quote_atas_by_owner[authority.pubkey]
        return FutarchyProgram.withdrawLiquidity(
            params,
            dao=context.dao,
            positionAuthority=authority,
            liquidityProviderBaseAccount=base_account,
            liquidityProviderQuoteAccount=quote_account,
            ammBaseVault=context.amm_base_vault,
            ammQuoteVault=context.amm_quote_vault,
            ammPosition=position,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def candidates(self):
        """Include the Squads-owned estate position after liquidation."""
        context = self.context
        result = list(context.live_positions())
        position = context.position_accounts.get(context.council.pubkey)
        if context.is_liquidated() and position is not None and position.exists:
            decoded = AmmPosition.decode(position.data)
            if decoded.liquidity > 0:
                result.append((context.council, position, decoded))
        return result

    def recipient_accounts(self, authority: Account) -> tuple[Account, Account]:
        context = self.context
        if authority.pubkey == context.council.pubkey:
            return context.council_base_account, context.council_quote_account
        return (
            context.base_atas_by_owner[authority.pubkey],
            context.quote_atas_by_owner[authority.pubkey],
        )

    def can_happy(self) -> bool:
        return self.context.is_spot() and bool(self.candidates())

    def happy(self) -> None:
        """Withdraw a random LP share and verify exact reserve/token deltas."""
        context = self.context
        authority, position, before_position = random.choice(
            self.candidates()
        )
        before_dao = context.dao_state()
        assert isinstance(before_dao.amm.state, PoolState.Spot)
        liquidity = random.randint(1, before_position.liquidity)
        spot = before_dao.amm.state.spot
        base = liquidity * spot.baseReserves // before_dao.amm.totalLiquidity
        quote = liquidity * spot.quoteReserves // before_dao.amm.totalLiquidity
        params = self.build_params(
            liquidity,
            random.randint(0, base),
            random.randint(0, quote),
        )
        instruction = self.build_instruction(authority, position, params)
        base_account, quote_account = self.recipient_accounts(authority)
        tracked = (
            context.dao,
            position,
            base_account,
            quote_account,
            context.amm_base_vault,
            context.amm_quote_vault,
        )
        before = self.snapshot(instruction, extra_accounts=tracked)
        if authority.pubkey == context.council.pubkey:
            prepared = context.squads.prepare_and_approve(
                instruction,
                purpose="post-liquidation council LP withdrawal",
                allow_admin_execute=True,
            )
            context.squads.execute_top_level(prepared)
        else:
            authority.tx(instruction)
        after_dao = context.dao_state()
        after_position = AmmPosition.decode(position.data)
        assert isinstance(after_dao.amm.state, PoolState.Spot)
        assert_changed_only(
            before_dao, after_dao, amm=after_dao.amm, seqNum=before_dao.seqNum + 1
        )
        assert_changed_only(
            before_dao.amm, after_dao.amm, state=after_dao.amm.state,
            totalLiquidity=before_dao.amm.totalLiquidity - liquidity,
        )
        assert_changed_only(
            spot, after_dao.amm.state.spot,
            baseReserves=spot.baseReserves - base, quoteReserves=spot.quoteReserves - quote,
        )
        assert_changed_only(
            before_position, after_position,
            liquidity=before_position.liquidity - liquidity,
        )
        assert token_balance(base_account) == (
            before.account(base_account).token_balance() + base
        )
        assert token_balance(quote_account) == (
            before.account(quote_account).token_balance() + quote
        )

    def can_unhappy(self) -> bool:
        return bool(self.context.live_positions())

    def unhappy(self) -> None:
        """Reject zero/excess LP, impossible slippage, or a live market."""
        context = self.context
        authority, position, decoded = random.choice(context.live_positions())
        if not context.is_spot():
            params = self.build_params(min(1, decoded.liquidity))
            expected = FutarchyProgram.PoolNotInSpotState
        else:
            case = random.randint(0, 2)
            if case == 0:
                params = self.build_params(0)
                expected = FutarchyProgram.ZeroLiquidityRemove
            elif case == 1:
                params = self.build_params(decoded.liquidity + 1)
                expected = FutarchyProgram.InsufficientBalance
            else:
                params = self.build_params(
                    min(1, decoded.liquidity), U64_MAX, U64_MAX
                )
                expected = FutarchyProgram.SwapSlippageExceeded
        instruction = self.build_instruction(authority, position, params)
        self.assert_fails_atomically(authority, instruction, expected)
