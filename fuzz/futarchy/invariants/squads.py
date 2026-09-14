"""Cross-instruction invariants for one-shot Futarchy Squads accounts."""

from __future__ import annotations

from wake_sol import invariant

from ..constants import FUTARCHY_PROGRAM_ID
from ..pytypes.futarchy import (
    EnqueuedMultisigProposalApproval,
    EnqueuedMultisigProposalCancellation,
)
from ..utils.accounts import (
    derive_enqueued_approval,
    derive_enqueued_cancellation,
)


class SquadsInvariants:
    """Validate all live enqueue records against their transaction indexes."""

    @invariant()
    def enqueued_approvals_are_canonical(self) -> None:
        """Every live one-shot record has the expected PDA and stored links."""
        for transaction in self.squads_transactions:
            account = transaction.enqueued_approval
            if account is None or not account.exists:
                continue
            expected, bump = derive_enqueued_approval(
                self.dao, transaction.index, FUTARCHY_PROGRAM_ID
            )
            decoded = EnqueuedMultisigProposalApproval.decode(account.data)
            assert account.pubkey == expected.pubkey
            assert decoded.pdaBump == bump
            assert decoded.dao == self.dao.pubkey
            assert decoded.transactionIndex == transaction.index

    @invariant()
    def enqueued_cancellations_are_canonical(self) -> None:
        """Every live cancellation record has the expected PDA and links."""
        for transaction in self.squads_transactions:
            account = transaction.enqueued_cancellation
            if account is None or not account.exists:
                continue
            expected, bump = derive_enqueued_cancellation(
                self.dao, transaction.index, FUTARCHY_PROGRAM_ID
            )
            decoded = EnqueuedMultisigProposalCancellation.decode(account.data)
            assert account.pubkey == expected.pubkey
            assert decoded.pdaBump == bump
            assert decoded.dao == self.dao.pubkey
            assert decoded.transactionIndex == transaction.index

    @invariant()
    def cancelled_transactions_never_execute(self) -> None:
        """Bookkeeping and the real Squads status agree for cancellations."""
        for transaction in self.squads_transactions:
            if transaction.cancelled:
                assert not transaction.executed
                self.squads.assert_proposal_status(transaction, "Cancelled")
