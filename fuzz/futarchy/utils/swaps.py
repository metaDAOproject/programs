"""Stateless swap bounds and fee checks without reproducing arbitrage."""

from ..constants import MAX_BPS
from ..pytypes.futarchy import Market, PoolState, SwapType
from .assertions import assert_changed_only
from .oracle import assert_twap_update


PROTOCOL_TAKER_FEE_BPS = 50


def assert_swap_transition(before, after, market, direction, amount, output, timestamp):
    """Check the direct quote lower bound, exact taker fee, and arb fee direction."""
    assert_changed_only(before, after, amm=after.amm, seqNum=before.seqNum + 1)
    assert_changed_only(before.amm, after.amm, state=after.amm.state)
    assert type(after.amm.state) is type(before.amm.state)
    names = (
        ("spot",)
        if isinstance(before.amm.state, PoolState.Spot)
        else ("spot", "pass_", "fail")
    )
    selected = {
        Market.Spot: "spot", Market.Pass: "pass_", Market.Fail: "fail"
    }[market]
    old_selected = getattr(before.amm.state, selected)
    buying = direction == SwapType.Buy
    input_side, output_side = ("quote", "base") if buying else ("base", "quote")
    net_input = amount * (MAX_BPS - PROTOCOL_TAKER_FEE_BPS) // MAX_BPS
    fee = amount - net_input
    input_reserve = getattr(old_selected, input_side + "Reserves")
    output_reserve = getattr(old_selected, output_side + "Reserves")
    direct_quote = net_input * output_reserve // (input_reserve + net_input)
    assert output >= direct_quote, "arbitrage must not reduce the direct swap output"

    for name in names:
        old = getattr(before.amm.state, name)
        new = getattr(after.amm.state, name)
        assert_twap_update(old, new, timestamp)
        assert (
            new.baseReserves * new.quoteReserves >= old.baseReserves * old.quoteReserves
        )
        for side in ("base", "quote"):
            field = side + "ProtocolFeeBalance"
            expected = getattr(old, field) + (
                fee if name == selected and side == input_side else 0
            )
            if name != "spot" and name != selected and side == output_side:
                assert getattr(new, field) >= expected
            else:
                assert getattr(new, field) == expected
