"""Snapshot-checked wrapper for Futarchy ``sponsor_proposal``."""

from __future__ import annotations

from wake_sol import Account, AnchorError, random

from .base import InstructionWrapper
from ..constants import FUTARCHY_PROGRAM_ID
from ..pytypes.futarchy import (
    Futarchy as FutarchyProgram,
    Proposal,
)
from ..utils.proposals import (
    is_currently_sponsored,
    proposal_kind_expectation,
)
from ..utils.state import ProposalAccounts
from ..utils.assertions import assert_changed_only


class SponsorProposalInstruction(InstructionWrapper):
    """Check that only the current team can sponsor a Draft exactly once."""

    def build_instruction(
        self, proposal: ProposalAccounts, team: Account
    ):
        context = self.context
        return FutarchyProgram.sponsorProposal(
            proposal=proposal.proposal,
            dao=context.dao,
            teamAddress=team,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def unsponsored(self) -> list[ProposalAccounts]:
        dao = self.context.dao_state()
        return [
            proposal
            for proposal in self.context.draft_proposals()
            if not is_currently_sponsored(
                self.context.proposal_state(proposal), dao
            )
            and proposal_kind_expectation(
                self.context.proposal_state(proposal).action
            ).sponsorship
            != "forbidden"
        ]

    def sponsored(self) -> list[ProposalAccounts]:
        dao = self.context.dao_state()
        return [
            proposal
            for proposal in self.context.draft_proposals()
            if is_currently_sponsored(
                self.context.proposal_state(proposal), dao
            )
        ]

    def can_happy(self) -> bool:
        return not self.context.is_liquidated() and bool(self.unsponsored())

    def happy(self) -> None:
        """Sponsor one Draft and verify only its flag plus DAO sequence moves."""
        context = self.context
        unsponsored = self.unsponsored()
        proposal = random.choice(unsponsored)
        team = context.signers_by_pubkey[context.dao_state().teamAddress]
        before_dao = context.dao_state()
        before_proposal = context.proposal_state(proposal)
        instruction = self.build_instruction(proposal, team)
        team.tx(instruction)
        after_dao = context.dao_state()
        after_proposal = Proposal.decode(proposal.proposal.data)
        assert_changed_only(before_dao, after_dao, seqNum=before_dao.seqNum + 1)
        assert_changed_only(before_proposal, after_proposal, sponsoredBy=team.pubkey)
        assert before_proposal.sponsoredBy != before_dao.teamAddress

    def negative_candidates(self):
        context = self.context
        dao = context.dao_state()
        candidates = []
        for proposal in context.draft_proposals():
            decoded = context.proposal_state(proposal)
            policy = proposal_kind_expectation(decoded.action).sponsorship
            if policy == "forbidden":
                candidates.append(
                    (
                        proposal,
                        context.signers_by_pubkey[dao.teamAddress],
                        FutarchyProgram.TeamSponsorshipForbidden,
                    )
                )
            elif is_currently_sponsored(decoded, dao):
                candidates.append(
                    (
                        proposal,
                        context.signers_by_pubkey[dao.teamAddress],
                        FutarchyProgram.ProposalAlreadySponsored,
                    )
                )
            else:
                candidates.append(
                    (proposal, context.outsider, AnchorError.ConstraintHasOne)
                )
        return candidates

    def can_unhappy(self) -> bool:
        return not self.context.is_liquidated() and bool(
            self.negative_candidates()
        )

    def unhappy(self) -> None:
        """Reject duplicate sponsorship or a signer that is not the team."""
        context = self.context
        proposal, team, expected = random.choice(self.negative_candidates())
        instruction = self.build_instruction(proposal, team)
        self.assert_fails_atomically(team, instruction, expected)
