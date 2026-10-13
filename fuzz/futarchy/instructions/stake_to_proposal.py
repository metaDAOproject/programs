"""Snapshot-checked wrapper for Futarchy ``stake_to_proposal``."""

from __future__ import annotations

from wake_sol import Account, random

from .base import InstructionWrapper
from ..constants import FUTARCHY_PROGRAM_ID
from ..pytypes.futarchy import (
    Futarchy as FutarchyProgram,
    Proposal,
    ProposalState,
    StakeAccount,
    StakeToProposalParams,
)
from ..utils.state import ProposalAccounts
from ..utils.tokens import token_balance
from ..utils.assertions import assert_changed_only


class StakeToProposalInstruction(InstructionWrapper):
    """Check stake custody, proposal aggregate, and canonical stake records."""

    @staticmethod
    def build_params(amount: int) -> StakeToProposalParams:
        return StakeToProposalParams(amount=amount)

    def build_instruction(
        self, proposal: ProposalAccounts, staker: Account, amount: int
    ):
        context = self.context
        stake = context.stake_account(proposal, staker)
        return FutarchyProgram.stakeToProposal(
            self.build_params(amount),
            proposal=proposal.proposal,
            dao=context.dao,
            stakerBaseAccount=context.base_atas_by_owner[staker.pubkey],
            proposalBaseAccount=proposal.proposal_base_account,
            stakeAccount=stake,
            staker=staker,
            payer=context.payer,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def candidates(self) -> list[tuple[ProposalAccounts, Account]]:
        context = self.context
        return [
            (proposal, actor)
            for proposal in context.draft_proposals()
            for actor in context.actors
            if token_balance(context.base_atas_by_owner[actor.pubkey]) > 0
        ]

    def can_happy(self) -> bool:
        return not self.context.is_liquidated() and bool(self.candidates())

    def happy(self) -> None:
        """Create/top up one stake and verify all three accounting locations."""
        context = self.context
        proposal, staker = random.choice(self.candidates())
        source = context.base_atas_by_owner[staker.pubkey]
        custody = proposal.proposal_base_account
        stake = context.stake_account(proposal, staker)
        amount = random.randint(1, min(token_balance(source), 250_000_000_000))
        instruction = self.build_instruction(proposal, staker, amount)
        before_dao = context.dao_state()
        before_proposal = context.proposal_state(proposal)
        before = self.snapshot(
            instruction,
            extra_accounts=(context.dao, proposal.proposal, source, custody, stake),
        )
        context.payer.tx(instruction, signers=[staker])
        after_dao = context.dao_state()
        after_proposal = Proposal.decode(proposal.proposal.data)
        after_stake = StakeAccount.decode(stake.data)
        assert isinstance(before_proposal.state, ProposalState.Draft)
        assert_changed_only(before_dao, after_dao, seqNum=before_dao.seqNum + 1)
        assert_changed_only(
            before_proposal, after_proposal,
            state=ProposalState.Draft(before_proposal.state.amountStaked + amount),
        )
        old_stake = (
            0
            if not before.account(stake).exists
            else before.decode(stake, StakeAccount).amount
        )
        assert after_stake.proposal == proposal.proposal.pubkey
        assert after_stake.staker == staker.pubkey
        assert after_stake.amount == old_stake + amount
        if before.account(stake).exists:
            assert_changed_only(
                before.decode(stake, StakeAccount), after_stake, amount=old_stake + amount
            )
        assert token_balance(source) == (
            before.account(source).token_balance() - amount
        )
        assert token_balance(custody) == (
            before.account(custody).token_balance() + amount
        )

    def can_unhappy(self) -> bool:
        return bool(self.context.draft_proposals())

    def unhappy(self) -> None:
        """Reject zero, over-balance, or post-liquidation stakes atomically."""
        context = self.context
        proposal = random.choice(context.draft_proposals())
        staker = random.choice(context.actors)
        if context.is_liquidated():
            amount = 0
            expected = FutarchyProgram.DaoLiquidated
        elif random.choice((False, True)):
            amount = 0
            expected = FutarchyProgram.InvalidAmount
        else:
            amount = token_balance(context.base_atas_by_owner[staker.pubkey]) + 1
            expected = FutarchyProgram.InsufficientTokenBalance
        instruction = self.build_instruction(proposal, staker, amount)
        self.assert_fails_atomically(
            context.payer, instruction, expected, signers=(staker,)
        )
