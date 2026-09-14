"""Small, stateless reference calculations for Futarchy TWAP assertions."""

from __future__ import annotations

from ..constants import PRICE_SCALE, TWAP_UPDATE_INTERVAL_SECONDS, U128_MAX
from ..pytypes.futarchy import Pool, TwapOracle


U128_MODULUS = 2**128


def assert_initial_oracle(oracle: TwapOracle, dao, timestamp: int, delay: int) -> None:
    """Validate a fresh market independently of its stored oracle values."""
    assert oracle == TwapOracle(
        aggregator=0,
        lastUpdatedTimestamp=timestamp,
        createdAtTimestamp=timestamp,
        lastPrice=0,
        lastObservation=dao.twapInitialObservation,
        maxObservationChangePerUpdate=dao.twapMaxObservationChangePerUpdate,
        initialObservation=dao.twapInitialObservation,
        startDelaySeconds=delay,
    )


def expected_oracle_after_update(pool: Pool, timestamp: int) -> TwapOracle:
    """Reproduce ``Pool::update_twap`` from a pre-swap pool snapshot."""
    oracle = pool.oracle
    if (
        timestamp
        < oracle.lastUpdatedTimestamp + TWAP_UPDATE_INTERVAL_SECONDS
        or pool.baseReserves == 0
        or pool.quoteReserves == 0
    ):
        return oracle

    price = pool.quoteReserves * PRICE_SCALE // pool.baseReserves
    if price > oracle.lastObservation:
        maximum = min(
            U128_MAX,
            oracle.lastObservation + oracle.maxObservationChangePerUpdate,
        )
        observation = min(price, maximum)
    else:
        minimum = max(
            0,
            oracle.lastObservation - oracle.maxObservationChangePerUpdate,
        )
        observation = max(price, minimum)

    start = oracle.createdAtTimestamp + oracle.startDelaySeconds
    if timestamp <= start:
        aggregator = oracle.aggregator
    else:
        effective_last_update = max(oracle.lastUpdatedTimestamp, start)
        elapsed = timestamp - effective_last_update
        aggregator = (
            oracle.aggregator + oracle.lastObservation * elapsed
        ) % U128_MODULUS

    return TwapOracle(
        aggregator=aggregator,
        lastUpdatedTimestamp=timestamp,
        createdAtTimestamp=oracle.createdAtTimestamp,
        lastPrice=price,
        lastObservation=observation,
        maxObservationChangePerUpdate=(
            oracle.maxObservationChangePerUpdate
        ),
        initialObservation=oracle.initialObservation,
        startDelaySeconds=oracle.startDelaySeconds,
    )


def assert_twap_update(before: Pool, after: Pool, timestamp: int) -> None:
    """Assert that a swap applied the exact pre-reserve oracle transition."""
    assert after.oracle == expected_oracle_after_update(before, timestamp)


def calculate_twap(oracle: TwapOracle, timestamp: int) -> int:
    """Mirror ``Pool::get_twap`` from ``state/futarchy_amm.rs``.

    This is a stateless reference calculation over the pre-instruction
    snapshot.
    """
    start = oracle.createdAtTimestamp + oracle.startDelaySeconds
    assert oracle.lastUpdatedTimestamp > start
    duration = timestamp - start
    assert duration > 0 and oracle.aggregator != 0
    final_interval = timestamp - oracle.lastUpdatedTimestamp
    final_contribution = (
        oracle.lastObservation * final_interval
    ) % U128_MODULUS
    total = (oracle.aggregator + final_contribution) % U128_MODULUS
    return total // duration
