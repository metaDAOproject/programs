"""Snapshot-checked wrapper for Futarchy ``provide_liquidity``."""

from __future__ import annotations

from wake_sol import Account, AnchorError, random

from .base import InstructionWrapper
from ..constants import (
    FUTARCHY_PROGRAM_ID,
    INITIAL_LIQUIDITY_SCALE,
    MIN_QUOTE_LIQUIDITY,
    TOKEN_SCALE,
)
from ..pytypes.futarchy import (
    AmmPosition,
    Dao,
    Futarchy as FutarchyProgram,
    PoolState,
    ProvideLiquidityParams,
)
from ..utils.accounts import derive_amm_position
from ..utils.tokens import token_balance
from ..utils.assertions import assert_changed_only


class ProvideLiquidityInstruction(InstructionWrapper):
    """Check deposits, reserve growth, and immutable LP-position accounting."""

    @staticmethod
    def build_params(
        quote: int, maximum_base: int, minimum_liquidity: int, authority: Account
    ) -> ProvideLiquidityParams:
        return ProvideLiquidityParams(
            quoteAmount=quote,
            maxBaseAmount=maximum_base,
            minLiquidity=minimum_liquidity,
            positionAuthority=authority.pubkey,
        )

    def position(self, authority: Account) -> Account:
        context = self.context
        account = context.position_accounts.get(authority.pubkey)
        if account is None:
            account, _ = derive_amm_position(
                context.dao, authority, FUTARCHY_PROGRAM_ID
            )
            account.label = f"AMM position for {authority.label}"
            context.position_accounts[authority.pubkey] = account
        return account

    def build_instruction(
        self,
        provider: Account,
        authority: Account,
        params: ProvideLiquidityParams,
    ):
        context = self.context
        return FutarchyProgram.provideLiquidity(
            params,
            dao=context.dao,
            liquidityProvider=provider,
            liquidityProviderBaseAccount=context.base_atas_by_owner[
                provider.pubkey
            ],
            liquidityProviderQuoteAccount=context.quote_atas_by_owner[
                provider.pubkey
            ],
            payer=context.payer,
            ammBaseVault=context.amm_base_vault,
            ammQuoteVault=context.amm_quote_vault,
            ammPosition=self.position(authority),
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    @staticmethod
    def amounts(dao: Dao, quote: int, maximum_base: int) -> tuple[int, int]:
        """Independently calculate the exact base and LP amounts for assertions."""
        assert isinstance(dao.amm.state, PoolState.Spot)
        spot = dao.amm.state.spot
        if dao.amm.totalLiquidity == 0:
            return maximum_base, quote * INITIAL_LIQUIDITY_SCALE
        base = (quote * spot.baseReserves + spot.quoteReserves - 1) // (
            spot.quoteReserves
        )
        liquidity = quote * dao.amm.totalLiquidity // spot.quoteReserves
        return base, liquidity

    def initial_providers(self) -> list[Account]:
        """Return actors able to satisfy both sides of an initial deposit."""
        context = self.context
        return [
            actor
            for actor in context.actors
            if token_balance(context.quote_atas_by_owner[actor.pubkey])
            >= MIN_QUOTE_LIQUIDITY
            and token_balance(context.base_atas_by_owner[actor.pubkey]) > 0
        ]

    def can_happy(self) -> bool:
        context = self.context
        if context.is_liquidated() or not context.is_spot():
            return False
        dao = context.dao_state()
        if dao.amm.totalLiquidity == 0:
            return bool(self.initial_providers())
        return bool(context.affordable_providers(10_000 * TOKEN_SCALE))

    def happy(self) -> None:
        """Provide initial or proportional liquidity and check exact deltas."""
        context = self.context
        before_dao = context.dao_state()
        if before_dao.amm.totalLiquidity == 0:
            provider = random.choice(self.initial_providers())
            maximum_quote = min(
                token_balance(context.quote_atas_by_owner[provider.pubkey]),
                10_000 * TOKEN_SCALE,
            )
            quote = random.randint(MIN_QUOTE_LIQUIDITY, maximum_quote)
            maximum_base = min(
                token_balance(context.base_atas_by_owner[provider.pubkey]),
                max(1, quote * 20),
            )
        else:
            provider, maximum_quote = random.choice(
                context.affordable_providers(10_000 * TOKEN_SCALE)
            )
            quote = random.randint(1, maximum_quote)
            maximum_base, _ = self.amounts(before_dao, quote, 0)
        authority = random.choice((provider, provider, context.council))
        base, liquidity = self.amounts(before_dao, quote, maximum_base)
        requested_base = (
            base
            if before_dao.amm.totalLiquidity == 0
            else base + random.randint(0, 3)
        )
        base, liquidity = self.amounts(before_dao, quote, requested_base)
        params = self.build_params(
            quote,
            requested_base,
            random.randint(0 if before_dao.amm.totalLiquidity == 0 else 1, liquidity),
            authority,
        )
        instruction = self.build_instruction(provider, authority, params)
        position = self.position(authority)
        tracked = (
            context.dao,
            context.base_atas_by_owner[provider.pubkey],
            context.quote_atas_by_owner[provider.pubkey],
            context.amm_base_vault,
            context.amm_quote_vault,
            position,
        )
        before = self.snapshot(instruction, extra_accounts=tracked)
        provider.tx(instruction, signers=[context.payer])
        after = self.snapshot(instruction, extra_accounts=tracked)
        after_dao = after.decode(context.dao, Dao)
        assert isinstance(after_dao.amm.state, PoolState.Spot)
        assert_changed_only(
            before_dao, after_dao, amm=after_dao.amm, seqNum=before_dao.seqNum + 1
        )
        assert_changed_only(
            before_dao.amm, after_dao.amm, state=after_dao.amm.state,
            totalLiquidity=before_dao.amm.totalLiquidity + liquidity,
        )
        assert_changed_only(
            before_dao.amm.state.spot, after_dao.amm.state.spot,
            baseReserves=before_dao.amm.state.spot.baseReserves + base,
            quoteReserves=before_dao.amm.state.spot.quoteReserves + quote,
        )
        old_position = (
            0
            if not before.account(position).exists
            else before.decode(position, AmmPosition).liquidity
        )
        decoded_position = after.decode(position, AmmPosition)
        assert decoded_position.dao == context.dao.pubkey
        assert decoded_position.positionAuthority == authority.pubkey
        assert decoded_position.liquidity == old_position + liquidity
        assert token_balance(context.base_atas_by_owner[provider.pubkey]) == (
            before.account(
                context.base_atas_by_owner[provider.pubkey]
            ).token_balance()
            - base
        )
        assert token_balance(context.quote_atas_by_owner[provider.pubkey]) == (
            before.account(
                context.quote_atas_by_owner[provider.pubkey]
            ).token_balance()
            - quote
        )

    def can_unhappy(self) -> bool:
        return bool(self.context.actors)

    def unhappy(self) -> None:
        """Reject one state-appropriate invalid deposit and prove rollback."""
        context = self.context
        provider = random.choice(context.actors)
        authority = provider
        dao = context.dao_state()
        if context.is_liquidated():
            params = self.build_params(1, 1, 0, authority)
            expected = FutarchyProgram.DaoLiquidated
        elif not context.is_spot():
            params = self.build_params(1, 1, 1, authority)
            expected = FutarchyProgram.PoolNotInSpotState
        elif dao.amm.totalLiquidity == 0:
            params = self.build_params(
                MIN_QUOTE_LIQUIDITY - 1, 1, 0, authority
            )
            expected = AnchorError.RequireGteViolated
        else:
            params = self.build_params(1, 2**64 - 1, 0, authority)
            expected = AnchorError.RequireGtViolated
        instruction = self.build_instruction(provider, authority, params)
        self.assert_fails_atomically(provider, instruction, expected)
