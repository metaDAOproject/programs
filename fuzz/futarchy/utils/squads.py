"""Normal Squads transaction setup used by Futarchy instruction wrappers."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any

from wake_sol import (
    Account,
    AccountMeta,
    Instruction,
    Pubkey,
    SYSTEM_PROGRAM_ID,
    signer,
    writable,
    writable_signer,
)

from ..constants import (
    COMPUTE_BUDGET_PROGRAM_ID,
    FUTARCHY_PROGRAM_ID,
    SQUADS_PROGRAM_ID,
    TRANSACTION_COMPUTE_UNIT_LIMIT,
)
from ..pytypes.futarchy import (
    AdminEnqueueMultisigProposalApprovalArgs,
    AdminEnqueueMultisigProposalCancellationArgs,
    Futarchy as FutarchyProgram,
)
from .accounts import (
    derive_enqueued_approval,
    derive_enqueued_cancellation,
    derive_squads_proposal,
    derive_squads_spending_limit,
    derive_squads_transaction,
    derive_squads_vault,
)
from .state import SquadsTransaction


@dataclass(frozen=True, slots=True)
class SquadsCompiledInstruction:
    """The execution-relevant portion of one stored Squads instruction."""

    program_id_index: int
    account_indexes: tuple[int, ...]
    data: bytes


@dataclass(frozen=True, slots=True)
class SquadsAddressTableLookup:
    account_key: Pubkey
    writable_indexes: tuple[int, ...]
    readonly_indexes: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class SquadsTransactionMessage:
    num_signers: int
    num_writable_signers: int
    num_writable_non_signers: int
    account_keys: tuple[Pubkey, ...]
    instructions: tuple[SquadsCompiledInstruction, ...]
    address_table_lookups: tuple[SquadsAddressTableLookup, ...]


@dataclass(frozen=True, slots=True)
class SquadsVaultTransaction:
    multisig: Pubkey
    creator: Pubkey
    index: int
    bump: int
    vault_index: int
    vault_bump: int
    ephemeral_signer_bumps: tuple[int, ...]
    message: SquadsTransactionMessage


@dataclass(frozen=True, slots=True)
class SquadsProposal:
    multisig: Pubkey
    transaction_index: int
    status: str
    status_timestamp: int | None
    bump: int
    approved: tuple[Pubkey, ...]
    rejected: tuple[Pubkey, ...]
    cancelled: tuple[Pubkey, ...]


@dataclass(frozen=True, slots=True)
class SquadsSpendingLimit:
    multisig: Pubkey
    create_key: Pubkey
    vault_index: int
    mint: Pubkey
    amount: int
    period: str
    remaining_amount: int
    last_reset: int
    bump: int
    members: tuple[Pubkey, ...]
    destinations: tuple[Pubkey, ...]


class _BorshReader:
    """Tiny bounded reader for the three pinned Squads account layouts."""

    def __init__(self, data: bytes) -> None:
        self.data = memoryview(data)
        self.offset = 0

    def take(self, size: int) -> bytes:
        end = self.offset + size
        if size < 0 or end > len(self.data):
            raise ValueError("truncated Squads account")
        value = bytes(self.data[self.offset:end])
        self.offset = end
        return value

    def uint(self, size: int) -> int:
        return int.from_bytes(self.take(size), "little")

    def i64(self) -> int:
        return int.from_bytes(self.take(8), "little", signed=True)

    def pubkey(self) -> Pubkey:
        return Pubkey(self.take(32))

    def byte_vec(self, length_size: int = 4) -> tuple[int, ...]:
        return tuple(self.take(self.uint(length_size)))

    def pubkey_vec(self) -> tuple[Pubkey, ...]:
        return tuple(self.pubkey() for _ in range(self.uint(4)))

    def finish_account(self) -> None:
        if any(self.take(len(self.data) - self.offset)):
            raise ValueError("non-zero bytes after Squads account payload")


def _account_reader(data: bytes, name: str) -> _BorshReader:
    reader = _BorshReader(data)
    discriminator = hashlib.sha256(f"account:{name}".encode()).digest()[:8]
    if reader.take(8) != discriminator:
        raise ValueError(f"invalid Squads {name} discriminator")
    return reader


def _read_compiled_instruction(
    reader: _BorshReader, length_size: int
) -> SquadsCompiledInstruction:
    return SquadsCompiledInstruction(
        program_id_index=reader.uint(1),
        account_indexes=reader.byte_vec(length_size),
        data=bytes(reader.byte_vec(2 if length_size == 1 else 4)),
    )


def _read_lookup(
    reader: _BorshReader, length_size: int
) -> SquadsAddressTableLookup:
    return SquadsAddressTableLookup(
        account_key=reader.pubkey(),
        writable_indexes=reader.byte_vec(length_size),
        readonly_indexes=reader.byte_vec(length_size),
    )


def _read_message(
    reader: _BorshReader, length_size: int
) -> SquadsTransactionMessage:
    num_signers = reader.uint(1)
    num_writable_signers = reader.uint(1)
    num_writable_non_signers = reader.uint(1)
    account_keys = tuple(reader.pubkey() for _ in range(reader.uint(length_size)))
    instructions = tuple(
        _read_compiled_instruction(reader, length_size)
        for _ in range(reader.uint(length_size))
    )
    address_table_lookups = tuple(
        _read_lookup(reader, length_size)
        for _ in range(reader.uint(length_size))
    )
    return SquadsTransactionMessage(
        num_signers=num_signers,
        num_writable_signers=num_writable_signers,
        num_writable_non_signers=num_writable_non_signers,
        account_keys=account_keys,
        instructions=instructions,
        address_table_lookups=address_table_lookups,
    )


def decode_squads_vault_transaction(data: bytes) -> SquadsVaultTransaction:
    """Decode the pinned Squads v4 ``VaultTransaction`` account."""
    reader = _account_reader(data, "VaultTransaction")
    value = SquadsVaultTransaction(
        multisig=reader.pubkey(),
        creator=reader.pubkey(),
        index=reader.uint(8),
        bump=reader.uint(1),
        vault_index=reader.uint(1),
        vault_bump=reader.uint(1),
        ephemeral_signer_bumps=reader.byte_vec(),
        message=_read_message(reader, 4),
    )
    reader.finish_account()
    return value


def decode_squads_proposal(data: bytes) -> SquadsProposal:
    """Decode the pinned Squads v4 ``Proposal`` account."""
    reader = _account_reader(data, "Proposal")
    multisig = reader.pubkey()
    transaction_index = reader.uint(8)
    status_tag = reader.uint(1)
    statuses = (
        "Draft",
        "Active",
        "Rejected",
        "Approved",
        "Executing",
        "Executed",
        "Cancelled",
    )
    if status_tag >= len(statuses):
        raise ValueError(f"invalid Squads proposal status {status_tag}")
    status_timestamp = None if status_tag == 4 else reader.i64()
    value = SquadsProposal(
        multisig=multisig,
        transaction_index=transaction_index,
        status=statuses[status_tag],
        status_timestamp=status_timestamp,
        bump=reader.uint(1),
        approved=reader.pubkey_vec(),
        rejected=reader.pubkey_vec(),
        cancelled=reader.pubkey_vec(),
    )
    reader.finish_account()
    return value


def decode_squads_spending_limit(data: bytes) -> SquadsSpendingLimit:
    """Decode the pinned Squads v4 ``SpendingLimit`` account."""
    reader = _account_reader(data, "SpendingLimit")
    multisig = reader.pubkey()
    create_key = reader.pubkey()
    vault_index = reader.uint(1)
    mint = reader.pubkey()
    amount = reader.uint(8)
    period_tag = reader.uint(1)
    periods = ("OneTime", "Day", "Week", "Month")
    if period_tag >= len(periods):
        raise ValueError(f"invalid Squads spending-limit period {period_tag}")
    value = SquadsSpendingLimit(
        multisig=multisig,
        create_key=create_key,
        vault_index=vault_index,
        mint=mint,
        amount=amount,
        period=periods[period_tag],
        remaining_amount=reader.uint(8),
        last_reset=reader.i64(),
        bump=reader.uint(1),
        members=reader.pubkey_vec(),
        destinations=reader.pubkey_vec(),
    )
    reader.finish_account()
    return value


def _decode_compact_message(data: bytes) -> SquadsTransactionMessage:
    """Decode the compact message supplied to Squads' create instruction."""
    reader = _BorshReader(data)
    value = _read_message(reader, 1)
    if reader.offset != len(reader.data):
        raise ValueError("trailing compact Squads transaction-message bytes")
    return value


class SquadsSupport:
    """Create, approve, and execute real Squads vault transactions."""

    VAULT_TRANSACTION_CREATE = hashlib.sha256(
        b"global:vault_transaction_create"
    ).digest()[:8]
    PROPOSAL_CREATE = hashlib.sha256(b"global:proposal_create").digest()[:8]
    VAULT_TRANSACTION_EXECUTE = hashlib.sha256(
        b"global:vault_transaction_execute"
    ).digest()[:8]

    def __init__(self, context: Any) -> None:
        self.context = context

    @staticmethod
    def compute_unit_limit(
        units: int = TRANSACTION_COMPUTE_UNIT_LIMIT,
    ) -> Instruction:
        """Build Solana's SetComputeUnitLimit instruction."""
        return Instruction(
            COMPUTE_BUDGET_PROGRAM_ID,
            [],
            bytes([2]) + units.to_bytes(4, "little"),
        )

    @staticmethod
    def compile_message(
        vault: Account,
        instructions: tuple[Instruction, ...],
    ) -> tuple[bytes, tuple[AccountMeta, ...]]:
        """Compile the Squads transaction-message format used on chain."""
        metadata: dict[Any, tuple[bool, bool]] = {vault.pubkey: (True, False)}
        for instruction in instructions:
            metadata.setdefault(instruction.program_id, (False, False))
            for account in instruction.accounts:
                old_signer, old_writable = metadata.get(
                    account.pubkey, (False, False)
                )
                metadata[account.pubkey] = (
                    old_signer or account.is_signer,
                    old_writable or account.is_writable,
                )

        groups: list[list[Any]] = [[], [], [], []]
        for key in sorted(metadata, key=bytes):
            is_signer, is_writable = metadata[key]
            if is_signer and is_writable:
                groups[0].append(key)
            elif is_signer:
                if key == vault.pubkey:
                    groups[1].insert(0, key)
                else:
                    groups[1].append(key)
            elif is_writable:
                groups[2].append(key)
            else:
                groups[3].append(key)

        keys = tuple(key for group in groups for key in group)
        num_signers = len(groups[0]) + len(groups[1])
        indexes = {key: index for index, key in enumerate(keys)}
        message = bytearray(
            [num_signers, len(groups[0]), len(groups[2]), len(keys)]
        )
        for key in keys:
            message.extend(bytes(key))
        message.append(len(instructions))
        for instruction in instructions:
            account_indexes = [indexes[meta.pubkey] for meta in instruction.accounts]
            message.append(indexes[instruction.program_id])
            message.append(len(account_indexes))
            message.extend(account_indexes)
            message.extend(len(instruction.data).to_bytes(2, "little"))
            message.extend(instruction.data)
        message.append(0)

        metas: list[AccountMeta] = []
        for index, key in enumerate(keys):
            is_signer = index < num_signers and key != vault.pubkey
            is_writable = (
                index < len(groups[0])
                or num_signers <= index < num_signers + len(groups[2])
            )
            metas.append(AccountMeta(key, is_signer, is_writable))
        return bytes(message), tuple(metas)

    def assert_proposal_status(
        self,
        prepared: SquadsTransaction,
        expected: str,
    ) -> SquadsProposal:
        """Assert a Squads proposal's canonical identity and exact status."""
        expected_account, bump = derive_squads_proposal(
            self.context.squads_multisig,
            prepared.index,
            SQUADS_PROGRAM_ID,
        )
        assert prepared.proposal.pubkey == expected_account.pubkey
        assert prepared.proposal.owner == SQUADS_PROGRAM_ID
        proposal = decode_squads_proposal(prepared.proposal.data)
        assert proposal.multisig == self.context.squads_multisig.pubkey
        assert proposal.transaction_index == prepared.index
        assert proposal.bump == bump
        assert proposal.status == expected
        dao_vote = (self.context.dao.pubkey,)
        if expected in ("Approved", "Executed"):
            assert proposal.approved == dao_vote
            assert proposal.rejected == ()
            assert proposal.cancelled == ()
        elif expected == "Rejected":
            assert proposal.approved == ()
            assert proposal.rejected == dao_vote
            assert proposal.cancelled == ()
        elif expected == "Cancelled":
            assert proposal.approved == dao_vote
            assert proposal.rejected == ()
            assert proposal.cancelled == dao_vote
        elif expected == "Active":
            assert proposal.approved == ()
            assert proposal.rejected == ()
            assert proposal.cancelled == ()
        return proposal

    def assert_prepared_transaction(
        self,
        prepared: SquadsTransaction,
        proposal_status: str = "Active",
    ) -> SquadsVaultTransaction:
        """Compare a stored transaction with the independently built payload."""
        context = self.context
        expected_account, bump = derive_squads_transaction(
            context.squads_multisig,
            prepared.index,
            SQUADS_PROGRAM_ID,
        )
        vault, vault_bump = derive_squads_vault(
            context.squads_multisig,
            SQUADS_PROGRAM_ID,
        )
        assert prepared.transaction.pubkey == expected_account.pubkey
        assert prepared.transaction.owner == SQUADS_PROGRAM_ID
        assert vault.pubkey == context.council.pubkey

        transaction = decode_squads_vault_transaction(prepared.transaction.data)
        expected_message, _ = self.compile_message(
            context.council, prepared.instructions
        )
        assert transaction.multisig == context.squads_multisig.pubkey
        assert transaction.creator == context.permissionless_account.pubkey
        assert transaction.index == prepared.index
        assert transaction.bump == bump
        assert transaction.vault_index == 0
        assert transaction.vault_bump == vault_bump
        assert transaction.ephemeral_signer_bumps == ()
        assert transaction.message == _decode_compact_message(expected_message)
        assert transaction.message.address_table_lookups == ()
        self.assert_proposal_status(prepared, proposal_status)
        return transaction

    def assert_spending_limit(
        self,
        config: Any | None,
        *,
        account: Account | None = None,
        multisig: Account | None = None,
        dao: Account | None = None,
        quote_mint: Account | None = None,
    ) -> None:
        """Assert the complete canonical Squads projection of a DAO limit."""
        context = self.context
        if account is None:
            account = context.squads_spending_limit
        if multisig is None:
            multisig = context.squads_multisig
        if dao is None:
            dao = context.dao
        if quote_mint is None:
            quote_mint = context.quote_mint
        if config is None:
            assert not account.exists
            return

        expected, bump = derive_squads_spending_limit(
            multisig,
            dao,
            SQUADS_PROGRAM_ID,
        )
        assert account.exists
        assert account.pubkey == expected.pubkey
        assert account.owner == SQUADS_PROGRAM_ID
        limit = decode_squads_spending_limit(account.data)
        assert limit.multisig == multisig.pubkey
        assert limit.create_key == dao.pubkey
        assert limit.vault_index == 0
        assert limit.mint == quote_mint.pubkey
        assert limit.amount == config.amountPerMonth
        assert limit.period == "Month"
        assert limit.remaining_amount == config.amountPerMonth
        assert limit.bump == bump
        assert limit.members == tuple(sorted(config.members, key=bytes))
        assert limit.destinations == ()

    def preview_next(
        self,
        *instructions: Instruction,
        purpose: str,
        allow_admin_execute: bool = False,
    ) -> SquadsTransaction:
        """Derive the next transaction without mutating Squads."""
        context = self.context
        index = context.squads_transaction_index + 1
        transaction, _ = derive_squads_transaction(
            context.squads_multisig, index, SQUADS_PROGRAM_ID
        )
        proposal, _ = derive_squads_proposal(
            context.squads_multisig, index, SQUADS_PROGRAM_ID
        )
        _, metas = self.compile_message(context.council, tuple(instructions))
        transaction.label = f"Squads transaction {index}: {purpose}"
        proposal.label = f"Squads proposal {index}: {purpose}"
        return SquadsTransaction(
            index=index,
            transaction=transaction,
            proposal=proposal,
            instructions=tuple(instructions),
            message_accounts=metas,
            purpose=purpose,
            allow_admin_execute=allow_admin_execute,
        )

    def build_create_instructions(
        self, prepared: SquadsTransaction
    ) -> tuple[Instruction, Instruction]:
        """Build Squads vault-transaction-create and proposal-create."""
        context = self.context
        message, _ = self.compile_message(
            context.council, prepared.instructions
        )
        create_transaction = Instruction(
            SQUADS_PROGRAM_ID,
            [
                writable(context.squads_multisig),
                writable(prepared.transaction),
                signer(context.permissionless_account),
                writable_signer(context.payer),
                SYSTEM_PROGRAM_ID,
            ],
            self.VAULT_TRANSACTION_CREATE
            + bytes([0, 0])
            + len(message).to_bytes(4, "little")
            + message
            + bytes([0]),
        )
        create_proposal = Instruction(
            SQUADS_PROGRAM_ID,
            [
                context.squads_multisig,
                writable(prepared.proposal),
                signer(context.permissionless_account),
                writable_signer(context.payer),
                SYSTEM_PROGRAM_ID,
            ],
            self.PROPOSAL_CREATE
            + prepared.index.to_bytes(8, "little")
            + bytes([False]),
        )
        return create_transaction, create_proposal

    def commit(self, prepared: SquadsTransaction) -> SquadsTransaction:
        """Register a transaction that was created by Squads or a typed CPI."""
        assert prepared.transaction.exists
        assert prepared.proposal.exists
        self.assert_prepared_transaction(prepared)
        self.context.squads_transaction_index = prepared.index
        self.context.squads_transactions.append(prepared)
        return prepared

    def prepare(
        self,
        *instructions: Instruction,
        purpose: str,
        allow_admin_execute: bool = False,
    ) -> SquadsTransaction:
        """Create one active Squads proposal through its normal instructions."""
        prepared = self.preview_next(
            *instructions,
            purpose=purpose,
            allow_admin_execute=allow_admin_execute,
        )
        create_transaction, create_proposal = self.build_create_instructions(
            prepared
        )
        self.context.payer.tx(
            create_transaction,
            create_proposal,
            signers=[self.context.permissionless_account],
        )
        return self.commit(prepared)

    def build_enqueue(
        self, prepared: SquadsTransaction, admin: Account
    ) -> tuple[Instruction, Account]:
        """Build Futarchy's admin-gated approval enqueue instruction."""
        enqueued, _ = derive_enqueued_approval(
            self.context.dao, prepared.index, FUTARCHY_PROGRAM_ID
        )
        enqueued.label = f"enqueued approval {prepared.index}"
        instruction = FutarchyProgram.adminEnqueueMultisigProposalApproval(
            AdminEnqueueMultisigProposalApprovalArgs(
                transactionIndex=prepared.index
            ),
            dao=self.context.dao,
            admin=admin,
            squadsMultisig=self.context.squads_multisig,
            squadsMultisigProposal=prepared.proposal,
            enqueuedApproval=enqueued,
        )
        return instruction, enqueued

    def build_approve(
        self,
        prepared: SquadsTransaction,
        enqueued: Account,
        rent_receiver: Account,
    ) -> Instruction:
        """Build the permissionless Futarchy-to-Squads approval CPI."""
        return FutarchyProgram.executeMultisigProposalApproval(
            dao=self.context.dao,
            rentReceiver=rent_receiver,
            squadsMultisig=self.context.squads_multisig,
            squadsMultisigProposal=prepared.proposal,
            enqueuedApproval=enqueued,
            squadsMultisigProgram=SQUADS_PROGRAM_ID,
        )

    def build_enqueue_cancellation(
        self, prepared: SquadsTransaction, admin: Account
    ) -> tuple[Instruction, Account]:
        """Build the admin/liquidator-gated cancellation enqueue."""
        enqueued, _ = derive_enqueued_cancellation(
            self.context.dao, prepared.index, FUTARCHY_PROGRAM_ID
        )
        enqueued.label = f"enqueued cancellation {prepared.index}"
        instruction = FutarchyProgram.adminEnqueueMultisigProposalCancellation(
            AdminEnqueueMultisigProposalCancellationArgs(
                transactionIndex=prepared.index
            ),
            dao=self.context.dao,
            admin=admin,
            squadsMultisig=self.context.squads_multisig,
            squadsMultisigProposal=prepared.proposal,
            enqueuedCancellation=enqueued,
        )
        return instruction, enqueued

    def build_cancel(
        self,
        prepared: SquadsTransaction,
        enqueued: Account,
        rent_receiver: Account,
    ) -> Instruction:
        """Build permissionless execution of an enqueued cancellation."""
        return FutarchyProgram.executeMultisigProposalCancellation(
            dao=self.context.dao,
            rentReceiver=rent_receiver,
            squadsMultisig=self.context.squads_multisig,
            squadsMultisigProposal=prepared.proposal,
            enqueuedCancellation=enqueued,
            squadsMultisigProgram=SQUADS_PROGRAM_ID,
        )

    def approve_for_dependency(
        self, prepared: SquadsTransaction, admin: Account | None = None
    ) -> None:
        """Normally enqueue and approve a transaction needed by another flow."""
        authority = admin or self.context.enqueue_authority()
        enqueue, enqueued = self.build_enqueue(prepared, authority)
        authority.tx(enqueue)
        prepared.enqueued_approval = enqueued
        approve = self.build_approve(prepared, enqueued, self.context.payer)
        self.context.payer.tx(approve)
        assert not enqueued.exists
        prepared.enqueued_approval = None
        self.assert_proposal_status(prepared, "Approved")
        prepared.approved = True

    def prepare_and_approve(
        self,
        *instructions: Instruction,
        purpose: str,
        allow_admin_execute: bool = False,
    ) -> SquadsTransaction:
        """Create and approve a prerequisite Squads transaction normally."""
        prepared = self.prepare(
            *instructions,
            purpose=purpose,
            allow_admin_execute=allow_admin_execute,
        )
        self.approve_for_dependency(prepared)
        return prepared

    def build_execute(self, prepared: SquadsTransaction) -> Instruction:
        """Build ordinary top-level Squads vault execution."""
        return Instruction(
            SQUADS_PROGRAM_ID,
            [
                self.context.squads_multisig,
                writable(prepared.proposal),
                prepared.transaction,
                signer(self.context.permissionless_account),
                *prepared.message_accounts,
            ],
            self.VAULT_TRANSACTION_EXECUTE,
        )

    def execute_top_level(self, prepared: SquadsTransaction) -> Any:
        """Execute an approved payload directly through Squads."""
        result = self.context.payer.tx(
            self.compute_unit_limit(),
            self.build_execute(prepared),
            signers=[self.context.permissionless_account],
        )
        self.assert_proposal_status(prepared, "Executed")
        prepared.executed = True
        return result
