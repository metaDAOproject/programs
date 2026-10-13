"""Small independent expectations shared by proposal lifecycle wrappers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from ..constants import FUTARCHY_PROGRAM_ID
from ..pytypes.futarchy import Dao, Proposal, ProposalAction, ProposalState
from .accounts import derive_proposal
from .state import ProposalAccounts
from .assertions import assert_changed_only


DAY_SECONDS = 24 * 60 * 60


@dataclass(frozen=True, slots=True)
class ProposalKindExpectation:
    """Protocol constants duplicated intentionally as a test oracle."""

    duration_seconds: int
    pass_threshold_bps: int
    sponsorship: str
    council_can_block: bool = True
    cooldown_seconds: int = 0
    twap_start_delay_seconds: int = DAY_SECONDS


_EXPECTATIONS: tuple[tuple[type, ProposalKindExpectation], ...] = (
    (
        ProposalAction.LargeSpend,
        ProposalKindExpectation(
            DAY_SECONDS * 3 // 2,
            -1_000,
            "required",
            twap_start_delay_seconds=DAY_SECONDS // 2,
        ),
    ),
    (
        ProposalAction.MintTokens,
        ProposalKindExpectation(DAY_SECONDS * 5, 500, "optional"),
    ),
    (
        ProposalAction.SpendingLimitChange,
        ProposalKindExpectation(DAY_SECONDS * 5, 500, "required"),
    ),
    (
        ProposalAction.ExecuteArbitrary,
        ProposalKindExpectation(DAY_SECONDS * 10, 1_000, "optional"),
    ),
    (
        ProposalAction.HostileTakeover,
        ProposalKindExpectation(
            DAY_SECONDS * 20,
            1_000,
            "forbidden",
            cooldown_seconds=DAY_SECONDS * 20,
        ),
    ),
    (
        ProposalAction.HostileLiquidate,
        ProposalKindExpectation(
            DAY_SECONDS * 10,
            2_500,
            "forbidden",
            cooldown_seconds=DAY_SECONDS * 10,
        ),
    ),
    (
        ProposalAction.BuybackToken,
        ProposalKindExpectation(
            DAY_SECONDS * 10,
            1_000,
            "optional",
            cooldown_seconds=DAY_SECONDS * 90,
        ),
    ),
)


def proposal_kind_expectation(action: Any) -> ProposalKindExpectation:
    """Return independent constants for the decoded proposal action."""
    for action_type, expectation in _EXPECTATIONS:
        if isinstance(action, action_type):
            return expectation
    raise AssertionError(f"unsupported proposal action: {type(action)!r}")


def is_currently_sponsored(proposal: Proposal, dao: Dao) -> bool:
    """A historical sponsor only counts while it is still the DAO team."""
    return proposal.sponsoredBy == dao.teamAddress


def assert_initialized_proposal(
    context: Any,
    accounts: ProposalAccounts,
    before_dao: Dao,
    assert_action: Callable[[Any], None],
) -> Proposal:
    """Check the complete fresh Proposal snapshot shared by every initializer."""
    proposal = Proposal.decode(accounts.proposal.data)
    after_dao = context.dao_state()
    assert_changed_only(
        before_dao, after_dao,
        seqNum=before_dao.seqNum + 1, proposalCount=before_dao.proposalCount + 1,
    )
    expected_address, bump = derive_proposal(
        accounts.squads.proposal, FUTARCHY_PROGRAM_ID
    )
    assert accounts.proposal.pubkey == expected_address.pubkey
    assert accounts.proposal.owner == FUTARCHY_PROGRAM_ID
    assert proposal.pdaBump == bump
    assert proposal.number == after_dao.proposalCount
    assert proposal.proposer == context.proposal_proposer.pubkey
    assert proposal.timestampEnqueued == 0
    assert isinstance(proposal.state, ProposalState.Draft)
    assert proposal.state.amountStaked == 0
    assert proposal.dao == context.dao.pubkey
    assert proposal.squadsProposal == accounts.squads.proposal.pubkey
    assert proposal.question == accounts.question.pubkey
    assert proposal.baseVault == accounts.base_vault.pubkey
    assert proposal.quoteVault == accounts.quote_vault.pubkey
    assert proposal.failBaseMint == accounts.fail_base_mint.pubkey
    assert proposal.passBaseMint == accounts.pass_base_mint.pubkey
    assert proposal.failQuoteMint == accounts.fail_quote_mint.pubkey
    assert proposal.passQuoteMint == accounts.pass_quote_mint.pubkey
    assert proposal.sponsoredBy is None
    expectation = proposal_kind_expectation(proposal.action)
    assert proposal.durationInSeconds == expectation.duration_seconds
    assert proposal.passThresholdBps == expectation.pass_threshold_bps
    assert proposal.councilCanBlock == expectation.council_can_block
    assert_action(proposal.action)
    return proposal
