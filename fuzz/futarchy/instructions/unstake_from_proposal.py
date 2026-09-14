"""Snapshot-checked wrapper for Futarchy ``unstake_from_proposal``."""

from __future__ import annotations

from wake_sol import Account, random, svm

from .base import InstructionWrapper
from ..constants import FUTARCHY_PROGRAM_ID, MIN_PROPOSAL_UNSTAKE_DELAY_SECONDS
from ..pytypes.futarchy import (
    Futarchy as FutarchyProgram,
    Proposal,
    ProposalState,
    StakeAccount,
    UnstakeFromProposalParams,
)
from ..utils.state import ProposalAccounts
from ..utils.tokens import token_balance
from ..utils.assertions import assert_changed_only


class UnstakeFromProposalInstruction(InstructionWrapper):
    """Check returned custody and Draft-only aggregate stake reduction."""

    @staticmethod
    def build_params(amount: int) -> UnstakeFromProposalParams:
        return UnstakeFromProposalParams(amount=amount)

    def build_instruction(
        self,
        proposal: ProposalAccounts,
        staker: Account,
        stake: Account,
        amount: int,
    ):
        context = self.context
        return FutarchyProgram.unstakeFromProposal(
            self.build_params(amount),
            proposal=proposal.proposal,
            dao=context.dao,
            stakerBaseAccount=context.base_atas_by_owner[staker.pubkey],
            proposalBaseAccount=proposal.proposal_base_account,
            stakeAccount=stake,
            baseMint=context.base_mint,
            staker=staker,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def candidates(self):
        return [
            item
            for item in self.context.positive_stakes()
            if svm.clock.unix_timestamp
            >= self.context.proposal_state(item[0]).timestampEnqueued
            + MIN_PROPOSAL_UNSTAKE_DELAY_SECONDS
        ]

    def too_early_candidates(self):
        """Return launched positive stakes still inside the five-second lock."""
        now = svm.clock.unix_timestamp
        return [
            item
            for item in self.context.positive_stakes()
            if self.context.proposal_state(item[0]).timestampEnqueued > 0
            and now
            < self.context.proposal_state(item[0]).timestampEnqueued
            + MIN_PROPOSAL_UNSTAKE_DELAY_SECONDS
        ]

    def can_happy(self) -> bool:
        return bool(self.candidates())

    def happy(self) -> None:
        """Unstake a random positive amount and verify the exact transfer."""
        context = self.context
        proposal, staker, stake = random.choice(self.candidates())
        old_stake = StakeAccount.decode(stake.data)
        amount = random.randint(1, old_stake.amount)
        source = proposal.proposal_base_account
        destination = context.base_atas_by_owner[staker.pubkey]
        before_dao = context.dao_state()
        before_proposal = context.proposal_state(proposal)
        instruction = self.build_instruction(
            proposal, staker, stake, amount
        )
        before = self.snapshot(
            instruction,
            extra_accounts=(
                context.dao,
                proposal.proposal,
                stake,
                source,
                destination,
            ),
        )
        staker.tx(instruction)
        after_dao = context.dao_state()
        after_proposal = Proposal.decode(proposal.proposal.data)
        after_stake = StakeAccount.decode(stake.data)
        assert_changed_only(before_dao, after_dao, seqNum=before_dao.seqNum + 1)
        assert_changed_only(old_stake, after_stake, amount=old_stake.amount - amount)
        expected_state = before_proposal.state
        if isinstance(expected_state, ProposalState.Draft):
            expected_state = ProposalState.Draft(expected_state.amountStaked - amount)
        assert_changed_only(before_proposal, after_proposal, state=expected_state)
        assert token_balance(source) == before.account(source).token_balance() - amount
        assert token_balance(destination) == (
            before.account(destination).token_balance() + amount
        )

    def can_unhappy(self) -> bool:
        return bool(self.too_early_candidates() or self.candidates())

    def unhappy(self) -> None:
        """Reject an early, zero, or excessive unstake and prove rollback."""
        context = self.context
        too_early = self.too_early_candidates()
        proposal, staker, stake = random.choice(
            too_early or self.candidates()
        )
        balance = StakeAccount.decode(stake.data).amount
        if too_early:
            amount = random.randint(1, balance)
            expected = FutarchyProgram.ProposalNotReadyToUnstake
        elif random.choice((False, True)):
            amount = 0
            expected = FutarchyProgram.InvalidAmount
        else:
            amount = balance + 1
            expected = FutarchyProgram.InsufficientTokenBalance
        instruction = self.build_instruction(proposal, staker, stake, amount)
        self.assert_fails_atomically(staker, instruction, expected)
