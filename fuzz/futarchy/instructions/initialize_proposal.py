"""Snapshot-checked wrapper for arbitrary ``initialize_proposal``."""

from __future__ import annotations

from wake_sol import AnchorError, random

from .base import InstructionWrapper
from ..constants import FUTARCHY_PROGRAM_ID
from ..pytypes.futarchy import (
    Dao,
    Futarchy as FutarchyProgram,
    ProposalAction,
)
from ..utils.accounts import derive_proposal
from ..utils.builders import memo_instruction
from ..utils.proposals import assert_initialized_proposal
from ..utils.state import ProposalAccounts


class InitializeProposalInstruction(InstructionWrapper):
    """Create real Squads/market prerequisites, then initialize the proposal."""

    def build_instruction(self, accounts: ProposalAccounts):
        """Wire one active Squads proposal to its binary conditional markets."""
        context = self.context
        return FutarchyProgram.initializeProposal(
            proposal=accounts.proposal,
            squadsProposal=accounts.squads.proposal,
            squadsMultisig=context.squads_multisig,
            dao=context.dao,
            question=accounts.question,
            quoteVault=accounts.quote_vault,
            baseVault=accounts.base_vault,
            proposer=context.proposal_proposer,
            payer=context.payer,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def _prepare(self, purpose: str) -> ProposalAccounts:
        context = self.context
        payload = memo_instruction(f"futarchy fuzz arbitrary {purpose}")
        prepared = context.squads.prepare(payload, purpose=purpose)
        return context.market_support.proposal_accounts(
            prepared, salt=purpose.encode()
        )

    def _assert_success(
        self, accounts: ProposalAccounts, before_dao: Dao
    ) -> None:
        context = self.context
        def assert_action(action) -> None:
            assert isinstance(action, ProposalAction.ExecuteArbitrary)

        assert_initialized_proposal(
            context,
            accounts,
            before_dao,
            assert_action,
        )
        context.register_proposal(accounts)

    def create_baseline(self) -> ProposalAccounts:
        """Create one initial arbitrary draft for immediate lifecycle coverage."""
        accounts = self._prepare("baseline arbitrary")
        before = self.context.dao_state()
        self.context.payer.tx(
            self.compute_unit_limit(), self.build_instruction(accounts)
        )
        self._assert_success(accounts, before)
        return accounts

    def can_happy(self) -> bool:
        return not self.context.is_liquidated()

    def happy(self) -> None:
        """Initialize a fresh arbitrary proposal and validate its account graph."""
        accounts = self._prepare(
            f"arbitrary {self.context.squads_transaction_index + 1}"
        )
        before = self.context.dao_state()
        self.context.payer.tx(
            self.compute_unit_limit(), self.build_instruction(accounts)
        )
        self._assert_success(accounts, before)

    def can_unhappy(self) -> bool:
        return not self.context.is_liquidated()

    def unhappy(self) -> None:
        """Reject a question whose oracle is not the new proposal PDA."""
        context = self.context
        prepared = context.squads.prepare(
            memo_instruction("invalid arbitrary proposal"),
            purpose="invalid arbitrary",
        )
        proposal, _ = derive_proposal(
            prepared.proposal, FUTARCHY_PROGRAM_ID
        )
        proposal.label = "invalid arbitrary proposal"
        wrong_oracle = random.choice(context.actors)
        market = context.market_support.create(
            wrong_oracle,
            salt=bytes(proposal.pubkey),
        )
        accounts = ProposalAccounts(
            proposal=proposal,
            squads=prepared,
            question=market.question,
            base_vault=market.base_vault,
            quote_vault=market.quote_vault,
            base_vault_underlying=market.base_vault_underlying,
            quote_vault_underlying=market.quote_vault_underlying,
            fail_base_mint=market.base_mints[0],
            pass_base_mint=market.base_mints[1],
            fail_quote_mint=market.quote_mints[0],
            pass_quote_mint=market.quote_mints[1],
        )
        instruction = self.build_instruction(accounts)
        self.assert_fails_atomically(
            context.payer,
            instruction,
            AnchorError.ConstraintRaw,
            before=(self.compute_unit_limit(),),
        )
