"""Boundary-biased generators for valid Futarchy configuration values."""

from __future__ import annotations

from wake_sol import random

from ..pytypes.futarchy import InitialSpendingLimit
from ..constants import (
    EXECUTE_ARBITRARY_DURATION_SECONDS,
    MAX_PASS_THRESHOLD_BPS,
    MAX_PROPOSAL_PASS_THRESHOLD_BPS,
    MAX_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
    MAX_SPENDING_LIMIT_MEMBERS,
    MIN_PROPOSAL_DURATION_SECONDS,
    MIN_PROPOSAL_PASS_THRESHOLD_BPS,
    MIN_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
    U32_MAX,
    U64_MAX,
    U128_MAX,
    V08_BASE_TO_STAKE,
    V08_LAUNCH_PRICE,
    V08_MIN_BASE_FUTARCHIC_LIQUIDITY,
    V08_MIN_QUOTE_FUTARCHIC_LIQUIDITY,
    V08_PASS_THRESHOLD_BPS,
    V08_SECONDS_PER_PROPOSAL,
    V08_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
    V08_TWAP_MAX_CHANGE,
    V08_TWAP_START_DELAY_SECONDS,
)


def boundary_biased_integer(
    minimum: int,
    maximum: int,
    *interesting: int,
) -> int:
    """Choose a boundary/production value often and a full-range value otherwise."""
    candidates = tuple(
        dict.fromkeys(
            value
            for value in (minimum, minimum + 1, *interesting, maximum - 1, maximum)
            if minimum <= value <= maximum
        )
    )
    if random.choice((True, True, False)):
        return random.choice(candidates)
    return random.randint(minimum, maximum)


def valid_pass_threshold_bps() -> int:
    """Generate the complete valid DAO pass-threshold range."""
    return boundary_biased_integer(
        0,
        MAX_PASS_THRESHOLD_BPS,
        V08_PASS_THRESHOLD_BPS,
    )


def valid_base_to_stake() -> int:
    """Generate a valid u64 stake requirement, including production and edges."""
    return boundary_biased_integer(0, U64_MAX, V08_BASE_TO_STAKE)


def valid_spending_limit_amount() -> int:
    """Generate any nonzero monthly allowance accepted by Squads."""
    return boundary_biased_integer(1, U64_MAX)


def valid_spending_limit_member_count(maximum: int) -> int:
    """Generate nonempty member-vector lengths accepted by Squads."""
    if not 1 <= maximum <= MAX_SPENDING_LIMIT_MEMBERS:
        raise ValueError("maximum must be within the protocol member limit")
    return boundary_biased_integer(1, maximum)


def valid_spending_limit(member_candidates) -> InitialSpendingLimit:
    """Build a valid nonempty, unique spending-limit configuration."""
    maximum = min(MAX_SPENDING_LIMIT_MEMBERS, len(member_candidates))
    count = valid_spending_limit_member_count(maximum)
    return InitialSpendingLimit(
        amountPerMonth=valid_spending_limit_amount(),
        members=[item.pubkey for item in random.sample(member_candidates, count)],
    )


def invalid_spending_limit(
    member_candidates,
) -> tuple[InitialSpendingLimit, str]:
    """Rotate through each validation guard and return its error name."""
    candidates = list(member_candidates)
    assert len(candidates) >= MAX_SPENDING_LIMIT_MEMBERS + 1
    choice = random.randint(0, 3)
    if choice == 0:
        return (
            InitialSpendingLimit(
                amountPerMonth=0,
                members=[candidates[0].pubkey],
            ),
            "InvalidSpendingLimitAmount",
        )
    if choice == 1:
        return (
            InitialSpendingLimit(amountPerMonth=1, members=[]),
            "EmptySpendingLimitMembers",
        )
    if choice == 2:
        member = candidates[0].pubkey
        return (
            InitialSpendingLimit(amountPerMonth=1, members=[member, member]),
            "DuplicateSpendingLimitMember",
        )
    return (
        InitialSpendingLimit(
            amountPerMonth=1,
            members=[
                item.pubkey
                for item in candidates[: MAX_SPENDING_LIMIT_MEMBERS + 1]
            ],
        ),
        "TooManySpendingLimitMembers",
    )


def valid_proposal_duration() -> int:
    """Generate any duration accepted for ExecuteArbitrary proposals."""
    return boundary_biased_integer(
        MIN_PROPOSAL_DURATION_SECONDS + 1,
        U32_MAX,
        EXECUTE_ARBITRARY_DURATION_SECONDS,
    )


def valid_proposal_pass_threshold_bps() -> int:
    """Generate the full admin-configurable proposal-threshold range."""
    return boundary_biased_integer(
        MIN_PROPOSAL_PASS_THRESHOLD_BPS,
        MAX_PROPOSAL_PASS_THRESHOLD_BPS,
        V08_PASS_THRESHOLD_BPS,
    )


def valid_dao_config() -> dict[str, int]:
    """Generate valid DAO fields over every serialized range.

    The delay is capped at ``u32::MAX // 2`` so its protocol-required doubled
    duration is representable as a u32. Duration is then generated from that
    relational lower bound through ``u32::MAX``.
    """
    delay = boundary_biased_integer(
        0,
        U32_MAX // 2,
        V08_TWAP_START_DELAY_SECONDS,
    )
    minimum_duration = max(
        MIN_PROPOSAL_DURATION_SECONDS,
        2 * delay,
    )
    duration = boundary_biased_integer(
        minimum_duration,
        U32_MAX,
        V08_SECONDS_PER_PROPOSAL,
    )
    return dict(
        pass_threshold_bps=valid_pass_threshold_bps(),
        seconds_per_proposal=duration,
        twap_initial_observation=boundary_biased_integer(
            0,
            U128_MAX,
            V08_LAUNCH_PRICE,
        ),
        twap_max_observation_change_per_update=boundary_biased_integer(
            1,
            U128_MAX,
            V08_TWAP_MAX_CHANGE,
        ),
        twap_start_delay_seconds=delay,
        min_quote_futarchic_liquidity=boundary_biased_integer(
            1,
            U64_MAX,
            V08_MIN_QUOTE_FUTARCHIC_LIQUIDITY,
        ),
        min_base_futarchic_liquidity=boundary_biased_integer(
            1,
            U64_MAX,
            V08_MIN_BASE_FUTARCHIC_LIQUIDITY,
        ),
        base_to_stake=valid_base_to_stake(),
        team_sponsored_pass_threshold_bps=boundary_biased_integer(
            MIN_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
            MAX_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
            V08_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
        ),
    )


def production_dao_config() -> dict[str, int]:
    """Return the documented v0.8 launchpad-style baseline."""
    return dict(
        pass_threshold_bps=V08_PASS_THRESHOLD_BPS,
        seconds_per_proposal=V08_SECONDS_PER_PROPOSAL,
        twap_initial_observation=V08_LAUNCH_PRICE,
        twap_max_observation_change_per_update=V08_TWAP_MAX_CHANGE,
        twap_start_delay_seconds=V08_TWAP_START_DELAY_SECONDS,
        min_quote_futarchic_liquidity=V08_MIN_QUOTE_FUTARCHIC_LIQUIDITY,
        min_base_futarchic_liquidity=V08_MIN_BASE_FUTARCHIC_LIQUIDITY,
        base_to_stake=V08_BASE_TO_STAKE,
        team_sponsored_pass_threshold_bps=(
            V08_TEAM_SPONSORED_PASS_THRESHOLD_BPS
        ),
    )
