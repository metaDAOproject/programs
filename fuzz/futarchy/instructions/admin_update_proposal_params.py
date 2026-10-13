"""Snapshot wrapper for Futarchy ``admin_update_proposal_params``."""

from __future__ import annotations

from wake_sol import Account, random

from .base import InstructionWrapper
from ..constants import FUTARCHY_PROGRAM_ID
from ..pytypes.futarchy import (
    AdminUpdateProposalParamsArgs,
    Futarchy as FutarchyProgram,
    Proposal,
    ProposalAction,
    ProposalState,
)
from ..utils.parameters import (
    valid_proposal_duration,
    valid_proposal_pass_threshold_bps,
)
from ..utils.state import ProposalAccounts
from ..utils.assertions import assert_changed_only


class AdminUpdateProposalParamsInstruction(InstructionWrapper):
    """Check Draft-only updates and preservation of every omitted field."""

    @staticmethod
    def build_args(
        duration: int | None, threshold: int | None
    ) -> AdminUpdateProposalParamsArgs:
        return AdminUpdateProposalParamsArgs(
            durationInSeconds=duration,
            passThresholdBps=threshold,
        )

    def build_instruction(
        self,
        proposal: ProposalAccounts,
        args: AdminUpdateProposalParamsArgs,
        admin: Account | None = None,
    ):
        context = self.context
        return FutarchyProgram.adminUpdateProposalParams(
            args,
            dao=context.dao,
            proposal=proposal.proposal,
            admin=admin or context.ops_admin,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def arbitrary_drafts(self):
        return [
            proposal
            for proposal in self.context.draft_proposals()
            if isinstance(
                self.context.proposal_state(proposal).action,
                ProposalAction.ExecuteArbitrary,
            )
        ]

    def typed_drafts(self):
        return [
            proposal
            for proposal in self.context.draft_proposals()
            if not isinstance(
                self.context.proposal_state(proposal).action,
                ProposalAction.ExecuteArbitrary,
            )
        ]

    def live_arbitrary(self):
        """Return arbitrary proposals whose immutable live terms are frozen."""
        return [
            proposal
            for proposal in self.context.proposals
            if proposal.proposal.exists
            and isinstance(
                self.context.proposal_state(proposal).action,
                ProposalAction.ExecuteArbitrary,
            )
            and isinstance(
                self.context.proposal_state(proposal).state,
                ProposalState.Pending,
            )
        ]

    def can_happy(self) -> bool:
        return not self.context.is_liquidated() and bool(self.arbitrary_drafts())

    def happy(self) -> None:
        """Update one or both arbitrary-Draft terms and verify exact fields."""
        context = self.context
        proposal = random.choice(self.arbitrary_drafts())
        duration = random.choice((None, valid_proposal_duration()))
        threshold = random.choice(
            (None, valid_proposal_pass_threshold_bps())
        )
        if duration is None and threshold is None:
            duration = 864_000
        args = self.build_args(duration, threshold)
        before_dao = context.dao_state()
        before = context.proposal_state(proposal)
        context.ops_admin.tx(self.build_instruction(proposal, args))
        after_dao = context.dao_state()
        after = Proposal.decode(proposal.proposal.data)
        assert_changed_only(before_dao, after_dao, seqNum=before_dao.seqNum + 1)
        assert_changed_only(
            before, after,
            durationInSeconds=duration if duration is not None else before.durationInSeconds,
            passThresholdBps=threshold if threshold is not None else before.passThresholdBps,
        )

    def can_unhappy(self) -> bool:
        return not self.context.is_liquidated() and bool(
            self.live_arbitrary()
            or self.arbitrary_drafts()
            or self.typed_drafts()
        )

    def unhappy(self) -> None:
        """Reject live terms, typed changes, or a no-op arbitrary update."""
        context = self.context
        live = self.live_arbitrary()
        arbitrary = self.arbitrary_drafts()
        typed = self.typed_drafts()
        cases = []
        if live:
            cases.append(
                (
                    random.choice(live),
                    self.build_args(864_000, None),
                    FutarchyProgram.ProposalNotInDraftState,
                )
            )
        if typed:
            cases.append(
                (
                    random.choice(typed),
                    self.build_args(864_000, None),
                    FutarchyProgram.InvalidProposalKind,
                )
            )
        if arbitrary:
            cases.append(
                (
                    random.choice(arbitrary),
                    self.build_args(None, None),
                    FutarchyProgram.EmptyProposalParamsUpdate,
                )
            )
        proposal, args, expected = random.choice(cases)
        instruction = self.build_instruction(proposal, args)
        self.assert_fails_atomically(context.ops_admin, instruction, expected)
