"""Snapshot wrapper for Futarchy ``admin_remove_proposal``."""

from __future__ import annotations

from wake_sol import Account, random

from .base import InstructionWrapper
from ..constants import FUTARCHY_PROGRAM_ID
from ..pytypes.futarchy import (
    Futarchy as FutarchyProgram,
    Proposal,
    ProposalState,
)
from ..utils.state import ProposalAccounts
from ..utils.squads import decode_squads_proposal
from ..utils.assertions import assert_changed_only


class AdminRemoveProposalInstruction(InstructionWrapper):
    """Check the direct administrative Draft-to-Removed transition."""

    def build_instruction(
        self, proposal: ProposalAccounts, admin: Account | None = None
    ):
        context = self.context
        return FutarchyProgram.adminRemoveProposal(
            proposal=proposal.proposal,
            dao=context.dao,
            admin=admin or context.proposal_admin,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def can_happy(self) -> bool:
        return bool(self.context.draft_proposals())

    def happy(self) -> None:
        """Remove one Draft while leaving its stake custody withdrawable."""
        context = self.context
        proposal = random.choice(context.draft_proposals())
        before_dao = context.dao_state()
        before_proposal = context.proposal_state(proposal)
        squads_status = decode_squads_proposal(
            proposal.squads.proposal.data
        ).status
        context.squads.assert_proposal_status(proposal.squads, squads_status)
        admin = context.proposal_admin
        admin.tx(self.build_instruction(proposal, admin))
        after_dao = context.dao_state()
        after = Proposal.decode(proposal.proposal.data)
        assert_changed_only(before_dao, after_dao, seqNum=before_dao.seqNum + 1)
        assert_changed_only(before_proposal, after, state=ProposalState.Removed())
        context.squads.assert_proposal_status(proposal.squads, squads_status)

    def can_unhappy(self) -> bool:
        return bool(self.context.proposals) and any(
            not isinstance(
                self.context.proposal_state(proposal).state,
                ProposalState.Draft,
            )
            for proposal in self.context.proposals
        )

    def unhappy(self) -> None:
        """Reject removing a proposal that has already left Draft."""
        context = self.context
        candidates = [
            proposal
            for proposal in context.proposals
            if not isinstance(
                context.proposal_state(proposal).state, ProposalState.Draft
            )
        ]
        proposal = random.choice(candidates)
        admin = context.proposal_admin
        instruction = self.build_instruction(proposal, admin)
        self.assert_fails_atomically(
            admin,
            instruction,
            FutarchyProgram.ProposalNotInDraftState,
        )
