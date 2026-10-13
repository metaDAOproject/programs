"""Snapshot-checked wrapper for Futarchy ``collect_fees``."""

from __future__ import annotations

from .base import InstructionWrapper
from ..constants import FUTARCHY_PROGRAM_ID
from ..pytypes.futarchy import Futarchy as FutarchyProgram, PoolState
from ..utils.tokens import token_balance
from ..utils.assertions import assert_changed_only


class CollectFeesInstruction(InstructionWrapper):
    """Check exact protocol-fee transfers without changing LP reserves."""

    def build_instruction(self, admin=None):
        context = self.context
        return FutarchyProgram.collectFees(
            dao=context.dao,
            admin=admin or context.fee_admin,
            baseTokenAccount=context.fee_base_account,
            quoteTokenAccount=context.fee_quote_account,
            ammBaseVault=context.amm_base_vault,
            ammQuoteVault=context.amm_quote_vault,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def can_happy(self) -> bool:
        state = self.context.dao_state().amm.state
        return isinstance(state, PoolState.Spot) and (
            state.spot.baseProtocolFeeBalance > 0
            or state.spot.quoteProtocolFeeBalance > 0
        )

    def happy(self) -> None:
        """Collect a nonzero accrued fee balance from one or both sides."""
        context = self.context
        before_dao = context.dao_state()
        assert isinstance(before_dao.amm.state, PoolState.Spot)
        old_spot = before_dao.amm.state.spot
        assert (
            old_spot.baseProtocolFeeBalance
            + old_spot.quoteProtocolFeeBalance
            > 0
        )
        admin = context.fee_admin
        instruction = self.build_instruction(admin)
        before = self.snapshot(
            instruction,
            extra_accounts=(
                context.dao,
                context.fee_base_account,
                context.fee_quote_account,
                context.amm_base_vault,
                context.amm_quote_vault,
            ),
        )
        admin.tx(instruction)
        after_dao = context.dao_state()
        assert isinstance(after_dao.amm.state, PoolState.Spot)
        new_spot = after_dao.amm.state.spot
        assert_changed_only(
            before_dao, after_dao, amm=after_dao.amm, seqNum=before_dao.seqNum + 1
        )
        assert_changed_only(before_dao.amm, after_dao.amm, state=after_dao.amm.state)
        assert_changed_only(
            old_spot, new_spot, baseProtocolFeeBalance=0, quoteProtocolFeeBalance=0
        )
        assert token_balance(context.fee_base_account) == (
            before.account(context.fee_base_account).token_balance()
            + old_spot.baseProtocolFeeBalance
        )
        assert token_balance(context.fee_quote_account) == (
            before.account(context.fee_quote_account).token_balance()
            + old_spot.quoteProtocolFeeBalance
        )
        assert token_balance(context.amm_base_vault) == (
            before.account(context.amm_base_vault).token_balance()
            - old_spot.baseProtocolFeeBalance
        )
        assert token_balance(context.amm_quote_vault) == (
            before.account(context.amm_quote_vault).token_balance()
            - old_spot.quoteProtocolFeeBalance
        )

    def can_unhappy(self) -> bool:
        return not self.context.is_spot()

    def unhappy(self) -> None:
        """Reject collection while conditional markets own AMM state."""
        admin = self.context.fee_admin
        instruction = self.build_instruction(admin)
        self.assert_fails_atomically(
            admin,
            instruction,
            FutarchyProgram.PoolNotInSpotState,
        )
