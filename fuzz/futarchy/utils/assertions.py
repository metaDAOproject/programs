"""Readable account snapshots for Futarchy transition and rollback checks."""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass, fields, replace
from typing import TypeVar

from wake_sol import Account, Instruction, Pubkey, must_fail


T = TypeVar("T")


def assert_changed_only(before: T, after: T, **changes: object) -> None:
    """Compare a complete decoded snapshot with its permitted field changes."""
    expected = replace(before, **changes)
    assert type(after) is type(expected), "account/state type changed"
    for field in fields(expected):
        assert getattr(after, field.name) == getattr(expected, field.name), (
            f"{type(before).__name__}.{field.name} differs from the expected snapshot"
        )


@dataclass(frozen=True, slots=True)
class AccountState:
    """One account at one point in time, including non-existence."""

    pubkey: Pubkey
    label: str
    exists: bool
    lamports: int
    owner: Pubkey | None
    data: bytes

    def decode(self, account_type: type[T]) -> T:
        """Decode this snapshot with a generated account type."""
        if not self.exists:
            raise AssertionError(f"{self.label} does not exist")
        return account_type.decode(self.data)

    def token_balance(self) -> int:
        """Read the classic SPL Token amount from captured account bytes."""
        if not self.exists or len(self.data) != 165:
            raise AssertionError(f"{self.label} is not a classic token account")
        return int.from_bytes(self.data[64:72], "little")

    def mint_supply(self) -> int:
        """Read a classic SPL Mint supply from captured account bytes."""
        assert self.exists and len(self.data) == 82, f"{self.label} is not a mint"
        return int.from_bytes(self.data[36:44], "little")


@dataclass(frozen=True, slots=True)
class AccountSnapshot:
    """An ordered, address-keyed collection with useful failure messages."""

    states: dict[Pubkey, AccountState]

    @classmethod
    def take(cls, accounts: Iterable[Account]) -> "AccountSnapshot":
        states: dict[Pubkey, AccountState] = {}
        for account in accounts:
            if account.pubkey in states:
                continue
            label = account.label or str(account.pubkey)
            if account.exists:
                states[account.pubkey] = AccountState(
                    pubkey=account.pubkey,
                    label=label,
                    exists=True,
                    lamports=account.lamports,
                    owner=account.owner,
                    data=bytes(account.data),
                )
            else:
                states[account.pubkey] = AccountState(
                    pubkey=account.pubkey,
                    label=label,
                    exists=False,
                    lamports=0,
                    owner=None,
                    data=b"",
                )
        return cls(states)

    def account(self, account: Account | Pubkey) -> AccountState:
        """Return a captured account by handle or address."""
        key = account.pubkey if isinstance(account, Account) else account
        try:
            return self.states[key]
        except KeyError as exc:
            raise AssertionError(f"account {key} was not snapshotted") from exc

    def decode(self, account: Account | Pubkey, account_type: type[T]) -> T:
        """Decode a captured generated account."""
        return self.account(account).decode(account_type)

    def assert_unchanged(
        self,
        after: "AccountSnapshot",
        *,
        ignore_lamports: Iterable[Pubkey] = (),
    ) -> None:
        """Report the first account-level difference after a failed tx."""
        ignored = set(ignore_lamports)
        assert self.states.keys() == after.states.keys(), "snapshot keys changed"
        for key, before_state in self.states.items():
            after_state = after.states[key]
            if before_state.exists != after_state.exists:
                raise AssertionError(
                    f"atomicity violation: {before_state.label} existence changed "
                    f"from {before_state.exists} to {after_state.exists}"
                )
            if before_state.owner != after_state.owner:
                raise AssertionError(
                    f"atomicity violation: {before_state.label} owner changed"
                )
            if before_state.data != after_state.data:
                raise AssertionError(
                    f"atomicity violation: {before_state.label} data changed"
                )
            if key not in ignored and before_state.lamports != after_state.lamports:
                raise AssertionError(
                    f"atomicity violation: {before_state.label} lamports changed "
                    f"from {before_state.lamports} to {after_state.lamports}"
                )


def writable_accounts(
    instructions: Iterable[Instruction],
    extra: Iterable[Account] = (),
) -> tuple[Account, ...]:
    """Collect every top-level writable account, including future accounts."""
    accounts: list[Account] = list(extra)
    seen = {account.pubkey for account in accounts}
    for instruction in instructions:
        for meta in instruction.accounts:
            if meta.is_writable and meta.pubkey not in seen:
                accounts.append(Account(meta.pubkey))
                seen.add(meta.pubkey)
    return tuple(accounts)


def assert_atomic_failure(
    action: Callable[[], object],
    expected: object,
    instructions: Iterable[Instruction],
    *,
    fee_payer: Account,
    extra_accounts: Iterable[Account] = (),
) -> None:
    """Require a typed failure and prove all writable accounts rolled back.

    The transaction fee is intentionally ignored on the fee payer; its data,
    owner, and existence are still compared. All other lamport changes are
    part of atomicity, including attempted account creation and closure.
    """
    accounts = writable_accounts(instructions, extra_accounts)
    before = AccountSnapshot.take(accounts)
    with must_fail(expected):
        action()
    after = AccountSnapshot.take(accounts)
    before.assert_unchanged(after, ignore_lamports=(fee_payer.pubkey,))
