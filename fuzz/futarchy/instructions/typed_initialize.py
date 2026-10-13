"""Shared mechanics for the six typed proposal initializer wrappers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from wake_sol import Instruction

from .base import InstructionWrapper
from ..constants import BINARY_QUESTION_OUTCOMES, FUTARCHY_PROGRAM_ID
from ..pytypes.futarchy import Dao
from ..utils.accounts import derive_proposal
from ..utils.proposals import assert_initialized_proposal
from ..utils.state import ProposalAccounts


class TypedInitializeInstruction(InstructionWrapper, ABC):
    """Keep typed wrappers small while checking the same account transition."""

    kind_name: str

    def common_accounts(self, accounts: ProposalAccounts) -> dict[str, Any]:
        """Return the account block embedded by every typed initializer."""
        context = self.context
        return dict(
            proposal=accounts.proposal,
            dao=context.dao,
            squadsMultisig=context.squads_multisig,
            squadsTransaction=accounts.squads.transaction,
            squadsProposal=accounts.squads.proposal,
            question=accounts.question,
            baseVault=accounts.base_vault,
            quoteVault=accounts.quote_vault,
            proposer=context.proposal_proposer,
            payer=context.payer,
            permissionlessAccount=context.permissionless_account,
            squadsProgram=context.squads_program_id,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    @abstractmethod
    def happy_args(self) -> Any:
        """Generate valid typed arguments."""

    @abstractmethod
    def payload(
        self, args: Any, accounts: ProposalAccounts
    ) -> tuple[Instruction, ...]:
        """Independently build the Squads payload baked by the program."""

    @abstractmethod
    def build_instruction(
        self, args: Any, accounts: ProposalAccounts, **overrides: Any
    ) -> Instruction:
        """Build the generated Futarchy instruction."""

    @abstractmethod
    def assert_action(self, action: Any, args: Any) -> None:
        """Check the typed action snapshot stored on the proposal."""

    @abstractmethod
    def unhappy_case(self) -> tuple[Any, Any, int, dict[str, Any]]:
        """Return args, error, outcome count, and optional account overrides."""

    def _prepare_accounts(
        self,
        args: Any,
        *,
        outcomes: int = BINARY_QUESTION_OUTCOMES,
        salt: bytes = b"",
    ) -> ProposalAccounts:
        context = self.context
        placeholder = context.squads.preview_next(
            purpose=self.kind_name
        )
        proposal, _ = derive_proposal(
            placeholder.proposal, FUTARCHY_PROGRAM_ID
        )
        proposal.label = (
            f"Futarchy proposal {placeholder.index}: {self.kind_name}"
        )
        market = context.market_support.create(
            proposal,
            outcomes=outcomes,
            salt=self.kind_name.encode() + salt,
        )
        accounts = ProposalAccounts(
            proposal=proposal,
            squads=placeholder,
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
        prepared = context.squads.preview_next(
            *self.payload(args, accounts),
            purpose=self.kind_name,
        )
        accounts.squads = prepared
        return accounts

    def _assert_success(
        self,
        accounts: ProposalAccounts,
        args: Any,
        before_dao: Dao,
    ) -> None:
        context = self.context
        context.squads.commit(accounts.squads)
        assert_initialized_proposal(
            context,
            accounts,
            before_dao,
            lambda action: self.assert_action(action, args),
        )
        context.register_proposal(accounts)

    def can_happy(self) -> bool:
        return not self.context.is_liquidated()

    def happy(self) -> None:
        """Initialize one valid typed proposal and validate stored intent."""
        context = self.context
        args = self.happy_args()
        accounts = self._prepare_accounts(
            args,
            salt=context.typed_market_nonce.to_bytes(4, "little"),
        )
        context.typed_market_nonce += 1
        before = context.dao_state()
        instruction = self.build_instruction(args, accounts)
        context.payer.tx(
            self.compute_unit_limit(),
            instruction,
            signers=[context.permissionless_account, context.proposal_proposer],
        )
        self._assert_success(accounts, args, before)

    def can_unhappy(self) -> bool:
        return not self.context.is_liquidated()

    def unhappy(self) -> None:
        """Exercise one isolated typed guard and prove nested CPI rollback."""
        context = self.context
        args, expected, outcomes, overrides = self.unhappy_case()
        accounts = self._prepare_accounts(
            args,
            outcomes=outcomes,
            salt=b"invalid" + context.typed_market_nonce.to_bytes(4, "little"),
        )
        context.typed_market_nonce += 1
        instruction = self.build_instruction(args, accounts, **overrides)
        self.assert_fails_atomically(
            context.payer,
            instruction,
            expected,
            before=(self.compute_unit_limit(),),
            signers=(context.permissionless_account, context.proposal_proposer),
        )
