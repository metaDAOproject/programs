"""Small account-handle records used to navigate the on-chain fuzz state."""

from __future__ import annotations

from dataclasses import dataclass, field

from wake_sol import Account, AccountMeta, Instruction, Pubkey


@dataclass(slots=True)
class SquadsTransaction:
    """Bookkeeping for a real Squads transaction created in this sequence."""

    index: int
    transaction: Account
    proposal: Account
    instructions: tuple[Instruction, ...]
    message_accounts: tuple[AccountMeta, ...]
    purpose: str
    enqueued_approval: Account | None = None
    enqueued_cancellation: Account | None = None
    approved: bool = False
    rejected: bool = False
    executed: bool = False
    cancelled: bool = False
    disabled: bool = False
    allow_admin_execute: bool = False


@dataclass(slots=True)
class MarketAccounts:
    """A Conditional Vault question and the two underlying-token markets."""

    question: Account
    base_vault: Account
    quote_vault: Account
    base_vault_underlying: Account
    quote_vault_underlying: Account
    base_mints: tuple[Account, ...]
    quote_mints: tuple[Account, ...]


@dataclass(slots=True)
class ProposalAccounts:
    """Addresses belonging to one normally initialized Futarchy proposal."""

    proposal: Account
    squads: SquadsTransaction
    question: Account
    base_vault: Account
    quote_vault: Account
    base_vault_underlying: Account
    quote_vault_underlying: Account
    fail_base_mint: Account
    pass_base_mint: Account
    fail_quote_mint: Account
    pass_quote_mint: Account
    proposal_base_account: Account | None = None
    amm_pass_base_vault: Account | None = None
    amm_pass_quote_vault: Account | None = None
    amm_fail_base_vault: Account | None = None
    amm_fail_quote_vault: Account | None = None
    conditional_accounts: dict[tuple[Pubkey, Pubkey], Account] = field(
        default_factory=dict
    )
    liquidator: Account | None = None

    @property
    def conditional_mints(self) -> tuple[Account, Account, Account, Account]:
        """Return outcome mints in base-fail/pass then quote-fail/pass order."""
        return (
            self.fail_base_mint,
            self.pass_base_mint,
            self.fail_quote_mint,
            self.pass_quote_mint,
        )
