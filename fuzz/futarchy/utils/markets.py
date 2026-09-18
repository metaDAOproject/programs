"""Create real Conditional Vault market plumbing for Futarchy proposals."""

from __future__ import annotations

import hashlib
from typing import Any

from wake_sol import (
    ASSOCIATED_TOKEN_PROGRAM_ID,
    Account,
    Instruction,
    SYSTEM_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    signer,
    svm,
    writable,
    writable_signer,
)

from ..constants import (
    BINARY_QUESTION_OUTCOMES,
    CONDITIONAL_VAULT_PROGRAM_ID,
    FUTARCHY_PROGRAM_ID,
    MARKET_TRADER_BASE_FUNDING,
    MARKET_TRADER_QUOTE_FUNDING,
)
from .accounts import (
    derive_conditional_mint,
    derive_conditional_vault,
    derive_proposal,
    derive_question,
)
from .state import MarketAccounts, ProposalAccounts, SquadsTransaction
from .tokens import create_ata, token_balance


class ConditionalMarketSupport:
    """Own external question/vault setup without pretending it is Futarchy."""

    INITIALIZE_QUESTION = hashlib.sha256(
        b"global:initialize_question"
    ).digest()[:8]
    INITIALIZE_VAULT = hashlib.sha256(
        b"global:initialize_conditional_vault"
    ).digest()[:8]
    SPLIT_TOKENS = hashlib.sha256(b"global:split_tokens").digest()[:8]

    def __init__(self, context: Any) -> None:
        self.context = context

    def create(
        self,
        proposal: Account,
        *,
        outcomes: int = BINARY_QUESTION_OUTCOMES,
        salt: bytes = b"",
    ) -> MarketAccounts:
        """Initialize a question plus base/quote vaults through real CPIs."""
        context = self.context
        question_id = hashlib.sha256(
            b"futarchy-fuzz-market" + bytes(proposal.pubkey) + salt
        ).digest()
        question, _ = derive_question(
            question_id,
            proposal,
            outcomes,
            CONDITIONAL_VAULT_PROGRAM_ID,
        )
        question.label = f"question for {proposal.label} ({outcomes} outcomes)"
        init_question = Instruction(
            CONDITIONAL_VAULT_PROGRAM_ID,
            [
                writable(question),
                writable_signer(context.payer),
                SYSTEM_PROGRAM_ID,
                context.vault_event_authority,
                CONDITIONAL_VAULT_PROGRAM_ID,
            ],
            self.INITIALIZE_QUESTION
            + question_id
            + bytes(proposal.pubkey)
            + bytes([outcomes]),
        )
        context.payer.tx(init_question)

        base = self._create_vault(
            question, context.base_mint, outcomes, "base"
        )
        quote = self._create_vault(
            question, context.quote_mint, outcomes, "quote"
        )
        context.register_token_account(context.base_mint, base[1])
        context.register_token_account(context.quote_mint, quote[1])
        return MarketAccounts(
            question=question,
            base_vault=base[0],
            quote_vault=quote[0],
            base_vault_underlying=base[1],
            quote_vault_underlying=quote[1],
            base_mints=base[2],
            quote_mints=quote[2],
        )

    def _create_vault(
        self,
        question: Account,
        underlying_mint: Account,
        outcomes: int,
        label: str,
    ) -> tuple[Account, Account, tuple[Account, ...]]:
        context = self.context
        vault, _ = derive_conditional_vault(
            question, underlying_mint, CONDITIONAL_VAULT_PROGRAM_ID
        )
        vault.label = f"{label} conditional vault"
        underlying = Account(svm.token.ata_address(vault, underlying_mint))
        underlying.label = f"{label} conditional-vault underlying ATA"
        mints = tuple(
            derive_conditional_mint(
                vault, outcome, CONDITIONAL_VAULT_PROGRAM_ID
            )[0]
            for outcome in range(outcomes)
        )
        for index, mint in enumerate(mints):
            mint.label = f"{label} outcome mint {index}"
        instruction = Instruction(
            CONDITIONAL_VAULT_PROGRAM_ID,
            [
                writable(vault),
                question,
                underlying_mint,
                writable(underlying),
                writable_signer(context.payer),
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID,
                SYSTEM_PROGRAM_ID,
                context.vault_event_authority,
                CONDITIONAL_VAULT_PROGRAM_ID,
                *(writable(mint) for mint in mints),
            ],
            self.INITIALIZE_VAULT,
        )
        context.payer.tx(context.instructions.compute_limit(), instruction)
        return vault, underlying, mints

    def proposal_accounts(
        self,
        prepared: SquadsTransaction,
        *,
        salt: bytes = b"",
    ) -> ProposalAccounts:
        """Derive a proposal and initialize its canonical binary markets."""
        proposal, _ = derive_proposal(prepared.proposal, FUTARCHY_PROGRAM_ID)
        proposal.label = f"Futarchy proposal {prepared.index}: {prepared.purpose}"
        market = self.create(proposal, salt=salt)
        return ProposalAccounts(
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

    def ensure_stake_account(self, proposal: ProposalAccounts) -> Account:
        """Create the proposal-owned base ATA used as stake custody."""
        if proposal.proposal_base_account is None:
            account = create_ata(
                self.context.payer,
                proposal.proposal,
                self.context.base_mint,
            )
            account.label = f"stake custody for {proposal.proposal.label}"
            proposal.proposal_base_account = account
            self.context.register_token_account(self.context.base_mint, account)
        return proposal.proposal_base_account

    def ensure_launch_accounts(self, proposal: ProposalAccounts) -> None:
        """Derive the four DAO-owned conditional-token ATAs used when live."""
        context = self.context
        fields = (
            ("amm_fail_base_vault", proposal.fail_base_mint),
            ("amm_pass_base_vault", proposal.pass_base_mint),
            ("amm_fail_quote_vault", proposal.fail_quote_mint),
            ("amm_pass_quote_vault", proposal.pass_quote_mint),
        )
        for field, mint in fields:
            if getattr(proposal, field) is None:
                account = Account(svm.token.ata_address(context.dao, mint))
                account.label = f"DAO {mint.label} ATA"
                setattr(proposal, field, account)

    def ensure_trader_tokens(
        self, proposal: ProposalAccounts, trader: Account
    ) -> None:
        """Split a modest amount of underlying into both market outcomes."""
        context = self.context
        self._ensure_split(
            proposal,
            trader,
            context.base_mint,
            context.base_atas_by_owner[trader.pubkey],
            proposal.base_vault,
            proposal.base_vault_underlying,
            (proposal.fail_base_mint, proposal.pass_base_mint),
            MARKET_TRADER_BASE_FUNDING,
        )
        self._ensure_split(
            proposal,
            trader,
            context.quote_mint,
            context.quote_atas_by_owner[trader.pubkey],
            proposal.quote_vault,
            proposal.quote_vault_underlying,
            (proposal.fail_quote_mint, proposal.pass_quote_mint),
            MARKET_TRADER_QUOTE_FUNDING,
        )

    def _ensure_split(
        self,
        proposal: ProposalAccounts,
        trader: Account,
        underlying_mint: Account,
        user_underlying: Account,
        vault: Account,
        vault_underlying: Account,
        conditional_mints: tuple[Account, Account],
        target: int,
    ) -> None:
        context = self.context
        conditional_accounts: list[Account] = []
        for mint in conditional_mints:
            key = (trader.pubkey, mint.pubkey)
            account = proposal.conditional_accounts.get(key)
            if account is None:
                account = create_ata(context.payer, trader, mint)
                account.label = f"{trader.label} {mint.label} ATA"
                proposal.conditional_accounts[key] = account
            conditional_accounts.append(account)
        minimum = min(token_balance(account) for account in conditional_accounts)
        if minimum >= target:
            return
        amount = min(target - minimum, token_balance(user_underlying))
        if amount <= 0:
            return
        instruction = Instruction(
            CONDITIONAL_VAULT_PROGRAM_ID,
            [
                proposal.question,
                writable(vault),
                writable(vault_underlying),
                signer(trader),
                writable(user_underlying),
                TOKEN_PROGRAM_ID,
                context.vault_event_authority,
                CONDITIONAL_VAULT_PROGRAM_ID,
                *(writable(mint) for mint in conditional_mints),
                *(writable(account) for account in conditional_accounts),
            ],
            self.SPLIT_TOKENS + amount.to_bytes(8, "little"),
        )
        trader.tx(context.instructions.compute_limit(), instruction)
