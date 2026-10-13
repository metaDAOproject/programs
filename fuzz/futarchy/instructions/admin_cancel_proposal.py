"""Snapshot wrapper for Futarchy ``admin_cancel_proposal``."""

from __future__ import annotations

from wake_sol import Account, random

from .base import InstructionWrapper
from ..constants import (
    CONDITIONAL_VAULT_PROGRAM_ID,
    FUTARCHY_PROGRAM_ID,
    SQUADS_PROGRAM_ID,
)
from ..pytypes.futarchy import (
    Futarchy as FutarchyProgram,
    ProposalAction,
)
from ..utils.state import ProposalAccounts
from ..utils.assertions import assert_changed_only
from ..utils.settlement import assert_market_settled
from ..utils.tokens import create_ata


class AdminCancelProposalInstruction(InstructionWrapper):
    """Check council cancellation resolves Fail and restores the spot pool."""

    def cancellable(self) -> list[ProposalAccounts]:
        """Keep the terminal liquidation lane alive while testing cancellation."""
        return [
            proposal
            for proposal in self.context.pending_proposals()
            if not isinstance(
                self.context.proposal_state(proposal).action,
                ProposalAction.HostileLiquidate,
            )
        ]

    def ensure_existing_market_atas(self, accounts: ProposalAccounts) -> None:
        """Create accounts that launch normally creates before cancellation."""
        context = self.context
        context.market_support.ensure_launch_accounts(accounts)
        for field, mint in (
            ("amm_pass_base_vault", accounts.pass_base_mint),
            ("amm_pass_quote_vault", accounts.pass_quote_mint),
            ("amm_fail_base_vault", accounts.fail_base_mint),
            ("amm_fail_quote_vault", accounts.fail_quote_mint),
        ):
            account = getattr(accounts, field)
            if not account.exists:
                setattr(accounts, field, create_ata(context.payer, context.dao, mint))

    def build_instruction(
        self, accounts: ProposalAccounts, admin: Account | None = None
    ):
        context = self.context
        return FutarchyProgram.adminCancelProposal(
            proposal=accounts.proposal,
            dao=context.dao,
            question=accounts.question,
            squadsProposal=accounts.squads.proposal,
            squadsMultisig=context.squads_multisig,
            squadsMultisigProgram=SQUADS_PROGRAM_ID,
            ammPassBaseVault=accounts.amm_pass_base_vault,
            ammPassQuoteVault=accounts.amm_pass_quote_vault,
            ammFailBaseVault=accounts.amm_fail_base_vault,
            ammFailQuoteVault=accounts.amm_fail_quote_vault,
            ammBaseVault=context.amm_base_vault,
            ammQuoteVault=context.amm_quote_vault,
            vaultProgram=CONDITIONAL_VAULT_PROGRAM_ID,
            vaultEventAuthority=context.vault_event_authority,
            quoteVault=accounts.quote_vault,
            quoteVaultUnderlyingTokenAccount=accounts.quote_vault_underlying,
            passQuoteMint=accounts.pass_quote_mint,
            failQuoteMint=accounts.fail_quote_mint,
            passBaseMint=accounts.pass_base_mint,
            failBaseMint=accounts.fail_base_mint,
            baseVault=accounts.base_vault,
            baseVaultUnderlyingTokenAccount=accounts.base_vault_underlying,
            admin=admin or context.proposal_admin,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def can_happy(self) -> bool:
        return not self.context.is_liquidated() and bool(self.cancellable())

    def happy(self) -> None:
        """Cancel one live blockable proposal and validate Fail resolution."""
        context = self.context
        accounts = random.choice(self.cancellable())
        self.ensure_existing_market_atas(accounts)
        before_dao = context.dao_state()
        instruction = self.build_instruction(accounts)
        before = self.snapshot(instruction)
        context.proposal_admin.tx(self.compute_unit_limit(), instruction)
        after_dao = context.dao_state()
        assert_market_settled(context, accounts, before, False)
        assert_changed_only(
            before_dao, after_dao, amm=after_dao.amm, seqNum=before_dao.seqNum + 1
        )
        context.squads.assert_proposal_status(accounts.squads, "Rejected")
        accounts.squads.rejected = True

    def can_unhappy(self) -> bool:
        return not self.context.is_liquidated() and bool(
            self.context.draft_proposals()
        )

    def unhappy(self) -> None:
        """Reject cancelling a Draft and prove every CPI account is unchanged."""
        context = self.context
        accounts = random.choice(context.draft_proposals())
        self.ensure_existing_market_atas(accounts)
        instruction = self.build_instruction(accounts)
        self.assert_fails_atomically(
            context.proposal_admin,
            instruction,
            FutarchyProgram.ProposalNotActive,
            before=(self.compute_unit_limit(),),
        )
