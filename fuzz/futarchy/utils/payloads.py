"""Check declared Squads payload effects from one transaction's snapshots."""

import hashlib
from dataclasses import fields, replace

from wake_sol import Account, svm

from ..constants import FUTARCHY_PROGRAM_ID, SPL_MEMO_PROGRAM_ID
from ..pytypes.futarchy import (
    AmmPosition,
    Dao,
    PoolState,
    SetSpendingLimitArgs,
    UpdateDaoParams,
    WithdrawLiquidityParams,
)
from .assertions import assert_changed_only


def _discriminator(name: str) -> bytes:
    return hashlib.sha256(f"global:{name}".encode()).digest()[:8]


UPDATE_DAO = _discriminator("update_dao")
SET_SPENDING_LIMIT = _discriminator("set_spending_limit")
WITHDRAW_LIQUIDITY = _discriminator("withdraw_liquidity")


def payload_state_allows_execution(context, transaction) -> bool:
    """Liquidation freezes DAO configuration, not approved SPL or memo payloads."""
    for instruction in transaction.instructions:
        if instruction.program_id != FUTARCHY_PROGRAM_ID:
            continue
        if not context.is_spot():
            return False
        if context.is_liquidated() and instruction.data[:8] != WITHDRAW_LIQUIDITY:
            return False
    return True


def assert_payload_effects(context, transaction, before) -> None:
    """Apply only the declared transfer/mint/config deltas; retain no shadow state."""
    expected_dao = before.decode(context.dao, Dao)
    balance_deltas, supply_deltas = {}, {}

    def change(deltas, key, amount):
        deltas[key] = deltas.get(key, 0) + amount

    for instruction in transaction.instructions:
        keys = [meta.pubkey for meta in instruction.accounts]
        data = bytes(instruction.data)
        if instruction.program_id == svm.token.program_id:
            assert len(data) == 9 and data[0] in (3, 7), "unsupported token payload"
            amount = int.from_bytes(data[1:9], "little")
            if data[0] == 3:  # Transfer
                change(balance_deltas, keys[0], -amount)
            else:  # MintTo
                change(supply_deltas, keys[0], amount)
            change(balance_deltas, keys[1], amount)
        elif instruction.program_id == FUTARCHY_PROGRAM_ID:
            if data[:8] == UPDATE_DAO:
                params = UpdateDaoParams.decode(data[8:])
                updates = {
                    field.name: getattr(params, field.name)
                    for field in fields(params)
                    if getattr(params, field.name) is not None
                }
                expected_dao = replace(
                    expected_dao, **updates, seqNum=expected_dao.seqNum + 1
                )
            elif data[:8] == SET_SPENDING_LIMIT:
                params = SetSpendingLimitArgs.decode(data[8:])
                expected_dao = replace(
                    expected_dao,
                    initialSpendingLimit=params.config,
                    spendingLimitDirty=True,
                    seqNum=expected_dao.seqNum + 1,
                )
            elif data[:8] == WITHDRAW_LIQUIDITY:
                params = WithdrawLiquidityParams.decode(data[8:])
                old_position = before.decode(keys[6], AmmPosition)
                liquidity = params.liquidityToWithdraw
                spot = expected_dao.amm.state.spot
                base = liquidity * spot.baseReserves // expected_dao.amm.totalLiquidity
                quote = liquidity * spot.quoteReserves // expected_dao.amm.totalLiquidity
                for source, destination, amount in (
                    (keys[4], keys[2], base), (keys[5], keys[3], quote)
                ):
                    change(balance_deltas, source, -amount)
                    change(balance_deltas, destination, amount)
                assert_changed_only(
                    old_position,
                    AmmPosition.decode(Account(keys[6]).data),
                    liquidity=old_position.liquidity - liquidity,
                )
                pool = replace(
                    spot,
                    baseReserves=spot.baseReserves - base,
                    quoteReserves=spot.quoteReserves - quote,
                )
                expected_dao = replace(
                    expected_dao,
                    seqNum=expected_dao.seqNum + 1,
                    amm=replace(
                        expected_dao.amm,
                        totalLiquidity=expected_dao.amm.totalLiquidity - liquidity,
                        state=PoolState.Spot(pool),
                    ),
                )
            else:
                raise AssertionError("add an effect assertion for this Futarchy payload")
        else:
            assert instruction.program_id == SPL_MEMO_PROGRAM_ID, "unsupported payload"

    assert_changed_only(expected_dao, context.dao_state())
    for key, old in before.states.items():
        if old.owner != svm.token.program_id:
            continue
        account = Account(key)
        expected_data = bytearray(old.data)
        if len(old.data) == 82:
            offset, amount = 36, old.mint_supply() + supply_deltas.get(key, 0)
        else:
            offset, amount = 64, old.token_balance() + balance_deltas.get(key, 0)
        expected_data[offset : offset + 8] = amount.to_bytes(8, "little")
        assert account.exists and account.owner == old.owner
        assert account.lamports == old.lamports
        assert bytes(account.data) == bytes(expected_data), (
            f"unexpected payload effect on {old.label}"
        )
