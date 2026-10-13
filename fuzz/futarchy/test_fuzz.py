"""Wake.sol fuzz campaign for the current Futarchy public API."""

from __future__ import annotations

import pytest

from wake_sol import FuzzTest, flow, random, svm

pytest.importorskip(
    "fuzz.futarchy.pytypes.futarchy",
    reason="generate Futarchy Wake bindings with fuzz/futarchy/gen_wake_idl.py",
)

from .constants import (
    CONDITIONAL_VAULT_SO,
    FLOWS_COUNT,
    FUTARCHY_SO,
    SEQUENCES_COUNT,
    SQUADS_PROGRAM_CONFIG_DATA,
    SQUADS_SO,
)
from .instructions import FutarchyInstructions
from .invariants import (
    DaoInvariants,
    PositionInvariants,
    ProposalInvariants,
    SquadsInvariants,
    TokenInvariants,
)
from .utils.harness import FutarchyScenarioHelpers
from .utils.markets import ConditionalMarketSupport
from .utils.setup import FutarchySequenceSetup
from .utils.squads import SquadsSupport


pytestmark = pytest.mark.skipif(
    not all(
        artifact.exists()
        for artifact in (
            FUTARCHY_SO,
            CONDITIONAL_VAULT_SO,
            SQUADS_SO,
            SQUADS_PROGRAM_CONFIG_DATA,
        )
    ),
    reason="a Futarchy, Conditional Vault, or Squads test artifact is missing",
)


class FutarchyFuzz(
    FutarchyScenarioHelpers,
    DaoInvariants,
    TokenInvariants,
    PositionInvariants,
    ProposalInvariants,
    SquadsInvariants,
    FuzzTest,
):
    """Exercise each in-scope instruction through compact happy/unhappy flows."""

    def pre_sequence(self) -> None:
        """Build the real dependency graph and one immediately useful Draft."""
        setup = FutarchySequenceSetup(self)
        setup.install_programs_and_clock()
        setup.create_signers_and_addresses()
        setup.create_tokens_and_bookkeeping()
        self.squads = SquadsSupport(self)
        self.market_support = ConditionalMarketSupport(self)
        self.instructions = FutarchyInstructions(self)
        setup.initialize_normal_state()

    # Time and ordinary Squads execution support the instruction-level flows.

    @flow(weight=350)
    def advance_clock(self) -> None:
        """Advance deterministic time far enough to exercise TWAP boundaries."""
        if self.hostile_liquidation_market_active():
            svm.warp_to_timestamp(
                svm.clock.unix_timestamp
                + random.randint(12 * 3_600, 36 * 3_600)
            )
            return
        svm.warp_to_timestamp(
            svm.clock.unix_timestamp + random.randint(60, 3 * 86_400)
        )

    @flow(
        weight=120,
        precondition=lambda self: self.instructions.execute_passed_payload.can_happy(),
    )
    def execute_passed_proposal_payload(self) -> None:
        """Execute approved proposal payloads through top-level Squads."""
        return self.instructions.execute_passed_payload.happy()

    # DAO initialization.

    @flow(
        weight=8,
        max_times=1,
        precondition=lambda self: self.instructions.initialize_dao.can_happy(),
    )
    def initialize_dao_happy(self) -> None:
        """Initialize an auxiliary DAO through Futarchy and Squads."""
        return self.instructions.initialize_dao.happy()

    @flow(
        weight=8,
        max_times=1,
        precondition=lambda self: self.instructions.initialize_dao.can_unhappy(),
    )
    def initialize_dao_unhappy(self) -> None:
        """Reject identical base and quote mints atomically."""
        return self.instructions.initialize_dao.unhappy()

    # Proposal initializers: arbitrary plus every current typed kind.

    @flow(
        weight=30,
        max_times=3,
        precondition=lambda self: self.instructions.initialize_proposal.can_happy(),
    )
    def initialize_proposal_happy(self) -> None:
        """Initialize a normal arbitrary proposal."""
        return self.instructions.initialize_proposal.happy()

    @flow(
        weight=10,
        max_times=2,
        precondition=lambda self: self.instructions.initialize_proposal.can_unhappy(),
    )
    def initialize_proposal_unhappy(self) -> None:
        """Reject a conditional question with the wrong oracle."""
        return self.instructions.initialize_proposal.unhappy()

    @flow(
        weight=35,
        max_times=3,
        precondition=lambda self: (
            self.instructions.initialize_large_spend_proposal.can_happy()
        ),
    )
    def initialize_large_spend_proposal_happy(self) -> None:
        """Initialize a capped team-spend proposal."""
        return self.instructions.initialize_large_spend_proposal.happy()

    @flow(
        weight=12,
        max_times=2,
        precondition=lambda self: (
            self.instructions.initialize_large_spend_proposal.can_unhappy()
        ),
    )
    def initialize_large_spend_proposal_unhappy(self) -> None:
        """Reject a missing limit or spend above its three-month cap."""
        return self.instructions.initialize_large_spend_proposal.unhappy()

    @flow(
        weight=35,
        max_times=3,
        precondition=lambda self: (
            self.instructions.initialize_mint_tokens_proposal.can_happy()
        ),
    )
    def initialize_mint_tokens_proposal_happy(self) -> None:
        """Initialize a vault-authorized mint proposal."""
        return self.instructions.initialize_mint_tokens_proposal.happy()

    @flow(
        weight=12,
        max_times=2,
        precondition=lambda self: (
            self.instructions.initialize_mint_tokens_proposal.can_unhappy()
        ),
    )
    def initialize_mint_tokens_proposal_unhappy(self) -> None:
        """Reject a mint account that is not the DAO base mint."""
        return self.instructions.initialize_mint_tokens_proposal.unhappy()

    @flow(
        weight=35,
        max_times=3,
        precondition=lambda self: (
            self.instructions.initialize_spending_limit_change_proposal.can_happy()
        ),
    )
    def initialize_spending_limit_change_proposal_happy(self) -> None:
        """Initialize a spending-limit set/remove proposal."""
        return self.instructions.initialize_spending_limit_change_proposal.happy()

    @flow(
        weight=12,
        max_times=2,
        precondition=lambda self: (
            self.instructions.initialize_spending_limit_change_proposal.can_unhappy()
        ),
    )
    def initialize_spending_limit_change_proposal_unhappy(self) -> None:
        """Reject one invalid spending-limit shape."""
        return self.instructions.initialize_spending_limit_change_proposal.unhappy()

    @flow(
        weight=35,
        max_times=3,
        precondition=lambda self: (
            self.instructions.initialize_hostile_takeover_proposal.can_happy()
        ),
    )
    def initialize_hostile_takeover_proposal_happy(self) -> None:
        """Initialize a declared team-takeover proposal."""
        return self.instructions.initialize_hostile_takeover_proposal.happy()

    @flow(
        weight=12,
        max_times=2,
        precondition=lambda self: (
            self.instructions.initialize_hostile_takeover_proposal.can_unhappy()
        ),
    )
    def initialize_hostile_takeover_proposal_unhappy(self) -> None:
        """Reject the current team or an invalid takeover spending limit."""
        return self.instructions.initialize_hostile_takeover_proposal.unhappy()

    @flow(
        weight=45,
        max_times=3,
        precondition=lambda self: (
            self.instructions.initialize_hostile_liquidate_proposal.can_happy()
        ),
    )
    def initialize_hostile_liquidate_proposal_happy(self) -> None:
        """Initialize a hostile liquidation proposal and its IP-transfer memo."""
        return self.instructions.initialize_hostile_liquidate_proposal.happy()

    @flow(
        weight=12,
        max_times=2,
        precondition=lambda self: (
            self.instructions.initialize_hostile_liquidate_proposal.can_unhappy()
        ),
    )
    def initialize_hostile_liquidate_proposal_unhappy(self) -> None:
        """Reject a liquidation proposal backed by a non-binary question."""
        return self.instructions.initialize_hostile_liquidate_proposal.unhappy()

    @flow(
        weight=35,
        max_times=3,
        precondition=lambda self: (
            self.instructions.initialize_buyback_token_proposal.can_happy()
        ),
    )
    def initialize_buyback_token_proposal_happy(self) -> None:
        """Initialize a valid staged token-buyback mandate."""
        return self.instructions.initialize_buyback_token_proposal.happy()

    @flow(
        weight=12,
        max_times=2,
        precondition=lambda self: (
            self.instructions.initialize_buyback_token_proposal.can_unhappy()
        ),
    )
    def initialize_buyback_token_proposal_unhappy(self) -> None:
        """Reject one simple invalid buyback bound."""
        return self.instructions.initialize_buyback_token_proposal.unhappy()

    # Proposal lifecycle.

    @flow(
        weight=250,
        precondition=lambda self: self.instructions.stake_to_proposal.can_happy(),
    )
    def stake_to_proposal_happy(self) -> None:
        """Stake base tokens into one Draft."""
        return self.instructions.stake_to_proposal.happy()

    @flow(
        weight=55,
        precondition=lambda self: self.instructions.stake_to_proposal.can_unhappy(),
    )
    def stake_to_proposal_unhappy(self) -> None:
        """Reject zero, excessive, or post-liquidation stake."""
        return self.instructions.stake_to_proposal.unhappy()

    @flow(
        weight=100,
        precondition=lambda self: self.instructions.unstake_from_proposal.can_happy(),
    )
    def unstake_from_proposal_happy(self) -> None:
        """Return a random portion of recorded stake."""
        return self.instructions.unstake_from_proposal.happy()

    @flow(
        weight=40,
        precondition=lambda self: self.instructions.unstake_from_proposal.can_unhappy(),
    )
    def unstake_from_proposal_unhappy(self) -> None:
        """Reject early, zero, or excessive unstaking."""
        return self.instructions.unstake_from_proposal.unhappy()

    @flow(
        weight=180,
        precondition=lambda self: self.instructions.sponsor_proposal.can_happy(),
    )
    def sponsor_proposal_happy(self) -> None:
        """Sponsor a Draft with the current team signer."""
        return self.instructions.sponsor_proposal.happy()

    @flow(
        weight=50,
        precondition=lambda self: self.instructions.sponsor_proposal.can_unhappy(),
    )
    def sponsor_proposal_unhappy(self) -> None:
        """Reject duplicate or unauthorized sponsorship."""
        return self.instructions.sponsor_proposal.unhappy()

    @flow(
        weight=300,
        precondition=lambda self: self.instructions.launch_proposal.can_happy(),
    )
    def launch_proposal_happy(self) -> None:
        """Launch an eligible Draft into conditional markets."""
        return self.instructions.launch_proposal.happy()

    @flow(
        weight=80,
        precondition=lambda self: self.instructions.launch_proposal.can_unhappy(),
    )
    def launch_proposal_unhappy(self) -> None:
        """Reject one unmet launch gate atomically."""
        return self.instructions.launch_proposal.unhappy()

    @flow(
        weight=250,
        precondition=lambda self: self.instructions.finalize_proposal.can_happy(),
    )
    def finalize_proposal_happy(self) -> None:
        """Finalize a mature market from independent TWAP snapshots."""
        return self.instructions.finalize_proposal.happy()

    @flow(
        weight=100,
        precondition=lambda self: self.instructions.finalize_proposal.can_unhappy(),
    )
    def finalize_proposal_unhappy(self) -> None:
        """Reject a young or uncranked proposal market."""
        return self.instructions.finalize_proposal.unhappy()

    # AMM and liquidity.

    @flow(
        weight=500,
        precondition=lambda self: self.instructions.provide_liquidity.can_happy(),
    )
    def provide_liquidity_happy(self) -> None:
        """Provide initial or proportional spot liquidity."""
        return self.instructions.provide_liquidity.happy()

    @flow(
        weight=100,
        precondition=lambda self: self.instructions.provide_liquidity.can_unhappy(),
    )
    def provide_liquidity_unhappy(self) -> None:
        """Reject one state-appropriate invalid LP deposit."""
        return self.instructions.provide_liquidity.unhappy()

    @flow(
        weight=350,
        precondition=lambda self: self.instructions.spot_swap.can_happy(),
    )
    def spot_swap_happy(self) -> None:
        """Trade the spot pool in either state/direction."""
        return self.instructions.spot_swap.happy()

    @flow(
        weight=70,
        precondition=lambda self: self.instructions.spot_swap.can_unhappy(),
    )
    def spot_swap_unhappy(self) -> None:
        """Reject insufficient input or impossible positive slippage."""
        return self.instructions.spot_swap.unhappy()

    @flow(
        weight=350,
        precondition=lambda self: self.instructions.conditional_swap.can_happy(),
    )
    def conditional_swap_happy(self) -> None:
        """Trade pass or fail claims while a proposal is live."""
        return self.instructions.conditional_swap.happy()

    @flow(
        weight=70,
        precondition=lambda self: self.instructions.conditional_swap.can_unhappy(),
    )
    def conditional_swap_unhappy(self) -> None:
        """Reject Spot as a conditional-market selector."""
        return self.instructions.conditional_swap.unhappy()

    @flow(
        weight=150,
        precondition=lambda self: self.instructions.withdraw_liquidity.can_happy(),
    )
    def withdraw_liquidity_happy(self) -> None:
        """Withdraw a random share, including after liquidation."""
        return self.instructions.withdraw_liquidity.happy()

    @flow(
        weight=60,
        precondition=lambda self: self.instructions.withdraw_liquidity.can_unhappy(),
    )
    def withdraw_liquidity_unhappy(self) -> None:
        """Reject zero, excessive, or mid-market LP withdrawal."""
        return self.instructions.withdraw_liquidity.unhappy()

    @flow(
        weight=80,
        precondition=lambda self: self.instructions.collect_fees.can_happy(),
    )
    def collect_fees_happy(self) -> None:
        """Collect exact protocol fees, including after liquidation."""
        return self.instructions.collect_fees.happy()

    @flow(
        weight=30,
        precondition=lambda self: self.instructions.collect_fees.can_unhappy(),
    )
    def collect_fees_unhappy(self) -> None:
        """Reject fee collection while a proposal market is live."""
        return self.instructions.collect_fees.unhappy()

    # DAO configuration and spending-limit projection.

    @flow(
        weight=40,
        precondition=lambda self: self.instructions.update_dao.can_happy(),
    )
    def update_dao_happy(self) -> None:
        """Execute one valid vault-signed DAO update."""
        return self.instructions.update_dao.happy()

    @flow(
        weight=20,
        precondition=lambda self: self.instructions.update_dao.can_unhappy(),
    )
    def update_dao_unhappy(self) -> None:
        """Reject an update that violates DAO bounds."""
        return self.instructions.update_dao.unhappy()

    @flow(
        weight=40,
        precondition=lambda self: self.instructions.set_spending_limit.can_happy(),
    )
    def set_spending_limit_happy(self) -> None:
        """Set/remove the authoritative spending-limit record."""
        return self.instructions.set_spending_limit.happy()

    @flow(
        weight=20,
        precondition=lambda self: self.instructions.set_spending_limit.can_unhappy(),
    )
    def set_spending_limit_unhappy(self) -> None:
        """Reject one invalid spending-limit shape."""
        return self.instructions.set_spending_limit.unhappy()

    @flow(
        weight=100,
        precondition=lambda self: self.instructions.sync_spending_limit.can_happy(),
    )
    def sync_spending_limit_happy(self) -> None:
        """Project a dirty DAO record into Squads."""
        return self.instructions.sync_spending_limit.happy()

    @flow(
        weight=30,
        precondition=lambda self: self.instructions.sync_spending_limit.can_unhappy(),
    )
    def sync_spending_limit_unhappy(self) -> None:
        """Reject a sync when no authoritative change is pending."""
        return self.instructions.sync_spending_limit.unhappy()

    # Squads administration.

    @flow(
        weight=60,
        precondition=lambda self: (
            self.instructions.admin_enqueue_multisig_proposal_approval.can_happy()
        ),
    )
    def admin_enqueue_multisig_proposal_approval_happy(self) -> None:
        """Enqueue approval with the admin or terminal liquidator."""
        return self.instructions.admin_enqueue_multisig_proposal_approval.happy()

    @flow(
        weight=25,
        precondition=lambda self: (
            self.instructions.admin_enqueue_multisig_proposal_approval.can_unhappy()
        ),
    )
    def admin_enqueue_multisig_proposal_approval_unhappy(self) -> None:
        """Reject a state/status/authority-invalid enqueue."""
        return self.instructions.admin_enqueue_multisig_proposal_approval.unhappy()

    @flow(
        weight=70,
        precondition=lambda self: (
            self.instructions.execute_multisig_proposal_approval.can_happy()
        ),
    )
    def execute_multisig_proposal_approval_happy(self) -> None:
        """Permissionlessly consume an enqueued approval."""
        return self.instructions.execute_multisig_proposal_approval.happy()

    @flow(
        weight=25,
        precondition=lambda self: (
            self.instructions.execute_multisig_proposal_approval.can_unhappy()
        ),
    )
    def execute_multisig_proposal_approval_unhappy(self) -> None:
        """Reject a mismatched Squads proposal PDA."""
        return self.instructions.execute_multisig_proposal_approval.unhappy()

    @flow(
        weight=60,
        precondition=lambda self: (
            self.instructions.admin_enqueue_multisig_proposal_cancellation.can_happy()
        ),
    )
    def admin_enqueue_multisig_proposal_cancellation_happy(self) -> None:
        """Enqueue cancellation of an approved Squads proposal."""
        return self.instructions.admin_enqueue_multisig_proposal_cancellation.happy()

    @flow(
        weight=25,
        precondition=lambda self: (
            self.instructions.admin_enqueue_multisig_proposal_cancellation.can_unhappy()
        ),
    )
    def admin_enqueue_multisig_proposal_cancellation_unhappy(self) -> None:
        """Reject cancellation enqueue before Squads approval."""
        return self.instructions.admin_enqueue_multisig_proposal_cancellation.unhappy()

    @flow(
        weight=70,
        precondition=lambda self: (
            self.instructions.execute_multisig_proposal_cancellation.can_happy()
        ),
    )
    def execute_multisig_proposal_cancellation_happy(self) -> None:
        """Permissionlessly consume an enqueued cancellation."""
        return self.instructions.execute_multisig_proposal_cancellation.happy()

    @flow(
        weight=25,
        precondition=lambda self: (
            self.instructions.execute_multisig_proposal_cancellation.can_unhappy()
        ),
    )
    def execute_multisig_proposal_cancellation_unhappy(self) -> None:
        """Reject execution without a cancellation authorization."""
        return self.instructions.execute_multisig_proposal_cancellation.unhappy()

    @flow(
        weight=35,
        precondition=lambda self: (
            self.instructions.admin_execute_multisig_proposal.can_happy()
        ),
    )
    def admin_execute_multisig_proposal_happy(self) -> None:
        """Execute an approved external Squads payload through Futarchy."""
        return self.instructions.admin_execute_multisig_proposal.happy()

    @flow(
        weight=20,
        precondition=lambda self: (
            self.instructions.admin_execute_multisig_proposal.can_unhappy()
        ),
    )
    def admin_execute_multisig_proposal_unhappy(self) -> None:
        """Reject administrative execution before Squads approval."""
        return self.instructions.admin_execute_multisig_proposal.unhappy()

    # Direct proposal administration.

    @flow(
        weight=20,
        precondition=lambda self: self.instructions.admin_cancel_proposal.can_happy(),
    )
    def admin_cancel_proposal_happy(self) -> None:
        """Cancel one live blockable proposal into Fail."""
        return self.instructions.admin_cancel_proposal.happy()

    @flow(
        weight=30,
        precondition=lambda self: self.instructions.admin_cancel_proposal.can_unhappy(),
    )
    def admin_cancel_proposal_unhappy(self) -> None:
        """Reject cancellation before launch."""
        return self.instructions.admin_cancel_proposal.unhappy()

    @flow(
        weight=20,
        precondition=lambda self: self.instructions.admin_remove_proposal.can_happy(),
    )
    def admin_remove_proposal_happy(self) -> None:
        """Remove one Draft while preserving withdrawals."""
        return self.instructions.admin_remove_proposal.happy()

    @flow(
        weight=30,
        precondition=lambda self: self.instructions.admin_remove_proposal.can_unhappy(),
    )
    def admin_remove_proposal_unhappy(self) -> None:
        """Reject removing a non-Draft proposal."""
        return self.instructions.admin_remove_proposal.unhappy()

    @flow(
        weight=50,
        precondition=lambda self: (
            self.instructions.admin_update_proposal_params.can_happy()
        ),
    )
    def admin_update_proposal_params_happy(self) -> None:
        """Update valid arbitrary-Draft terms."""
        return self.instructions.admin_update_proposal_params.happy()

    @flow(
        weight=30,
        precondition=lambda self: (
            self.instructions.admin_update_proposal_params.can_unhappy()
        ),
    )
    def admin_update_proposal_params_unhappy(self) -> None:
        """Reject live, typed, or empty Draft parameter updates."""
        return self.instructions.admin_update_proposal_params.unhappy()


def test_futarchy_stateful() -> None:
    """Run the coverage-tuning campaign configured in ``constants.py``."""
    FutarchyFuzz.run(
        sequences_count=SEQUENCES_COUNT,
        flows_count=FLOWS_COUNT,
    )
