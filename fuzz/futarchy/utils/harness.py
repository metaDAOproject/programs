"""Read-only selectors over the real accounts created during a fuzz sequence."""

from __future__ import annotations

from wake_sol import Account, Pubkey, svm

from ..constants import FUTARCHY_PROGRAM_ID
from ..pytypes.futarchy import (
    AmmPosition,
    Dao,
    PoolState,
    Proposal,
    ProposalAction,
    ProposalState,
    StakeAccount,
)
from .accounts import derive_stake_account
from .state import ProposalAccounts
from .tokens import create_ata, token_balance


class FutarchyScenarioHelpers:
    """Query on-chain state; retain only account handles as Python bookkeeping."""

    def register_token_account(self, mint: Account, account: Account) -> None:
        """Include an underlying-token account in supply conservation checks."""
        registry = (
            self.base_token_accounts
            if mint.pubkey == self.base_mint.pubkey
            else self.quote_token_accounts
        )
        registry[account.pubkey] = account

    def register_proposal(self, proposal: ProposalAccounts) -> None:
        """Record a normally initialized proposal and its stake custody ATA."""
        self.market_support.ensure_stake_account(proposal)
        self.proposals.append(proposal)

    def ensure_underlying_ata(
        self, owner: Account | Pubkey, mint: Account
    ) -> Account:
        """Create/register a base or quote ATA used by a proposal payload."""
        account = create_ata(self.payer, owner, mint)
        self.register_token_account(mint, account)
        return account

    def council_quote_balance(self) -> int:
        """Read the treasury quote balance used by executable payloads."""
        return token_balance(self.council_quote_account)

    def dao_state(self) -> Dao:
        """Decode the main DAO directly from SVM state."""
        return Dao.decode(self.dao.data)

    def proposal_state(self, proposal: ProposalAccounts) -> Proposal:
        """Decode one Futarchy proposal directly from SVM state."""
        return Proposal.decode(proposal.proposal.data)

    def enqueue_authority(self) -> Account:
        """Return the signer authorized to enqueue before/after liquidation."""
        liquidator = self.dao_state().liquidator
        if liquidator is None:
            return self.ops_admin
        return self.signers_by_pubkey[liquidator]

    def is_liquidated(self) -> bool:
        """Return whether terminal liquidation has landed."""
        return self.dao.exists and self.dao_state().liquidator is not None

    def is_spot(self) -> bool:
        """Return whether no proposal market currently occupies the AMM."""
        return isinstance(self.dao_state().amm.state, PoolState.Spot)

    def pool_has_liquidity(self) -> bool:
        """Return whether the physical spot pool can support swaps/launches."""
        state = self.dao_state().amm.state
        spot = state.spot
        return spot.baseReserves > 1 and spot.quoteReserves > 1

    def proposals_with_state(self, state_type: type) -> list[ProposalAccounts]:
        """Select initialized proposals by their decoded variant type."""
        return [
            proposal
            for proposal in self.proposals
            if proposal.proposal.exists
            and isinstance(self.proposal_state(proposal).state, state_type)
        ]

    def draft_proposals(self) -> list[ProposalAccounts]:
        """Return all non-stale Futarchy drafts."""
        return self.proposals_with_state(ProposalState.Draft)

    def pending_proposals(self) -> list[ProposalAccounts]:
        """Return the sole live proposal, if one exists."""
        return self.proposals_with_state(ProposalState.Pending)

    def hostile_liquidation_market_active(self) -> bool:
        """Return whether the active market is the delayed terminal lane."""
        return any(
            isinstance(
                self.proposal_state(proposal).action,
                ProposalAction.HostileLiquidate,
            )
            for proposal in self.pending_proposals()
        )

    def passed_proposals(self) -> list[ProposalAccounts]:
        """Return passed proposals whose Squads payload may still execute."""
        return self.proposals_with_state(ProposalState.Passed)

    def failed_or_passed_proposals(self) -> list[ProposalAccounts]:
        """Return proposals that are no longer live or editable."""
        return [
            proposal
            for proposal in self.proposals
            if isinstance(
                self.proposal_state(proposal).state,
                (ProposalState.Passed, ProposalState.Failed),
            )
        ]

    def finalizable_proposals(self) -> list[ProposalAccounts]:
        """Select mature markets whose two TWAPs have begun accumulating."""
        if self.is_spot():
            return []
        now = svm.clock.unix_timestamp
        result: list[ProposalAccounts] = []
        for proposal in self.pending_proposals():
            decoded = self.proposal_state(proposal)
            if now < decoded.timestampEnqueued + decoded.durationInSeconds:
                continue
            state = self.dao_state().amm.state
            assert isinstance(state, PoolState.Futarchy)
            if all(
                pool.oracle.lastUpdatedTimestamp
                > pool.oracle.createdAtTimestamp + pool.oracle.startDelaySeconds
                and pool.oracle.aggregator != 0
                for pool in (state.pass_, state.fail)
            ):
                result.append(proposal)
        return result

    def stake_account(self, proposal: ProposalAccounts, staker: Account) -> Account:
        """Return and register the canonical per-proposal stake PDA."""
        key = (proposal.proposal.pubkey, staker.pubkey)
        account = self.stake_accounts.get(key)
        if account is None:
            account, _ = derive_stake_account(
                proposal.proposal, staker, FUTARCHY_PROGRAM_ID
            )
            account.label = f"stake: {proposal.proposal.label} / {staker.label}"
            self.stake_accounts[key] = account
        return account

    def positive_stakes(self) -> list[tuple[ProposalAccounts, Account, Account]]:
        """Return proposal/staker/stake triples with a withdrawable balance."""
        proposals = {item.proposal.pubkey: item for item in self.proposals}
        result: list[tuple[ProposalAccounts, Account, Account]] = []
        for (proposal_key, staker_key), stake in self.stake_accounts.items():
            if not stake.exists:
                continue
            if StakeAccount.decode(stake.data).amount > 0:
                result.append(
                    (proposals[proposal_key], self.signers_by_pubkey[staker_key], stake)
                )
        return result

    def live_positions(self) -> list[tuple[Account, Account, AmmPosition]]:
        """Return signable authorities with positive LP positions."""
        result: list[tuple[Account, Account, AmmPosition]] = []
        for authority_key, position in self.position_accounts.items():
            authority = self.signers_by_pubkey.get(authority_key)
            if authority is None or not position.exists:
                continue
            decoded = AmmPosition.decode(position.data)
            if decoded.liquidity > 0:
                result.append((authority, position, decoded))
        return result

    def affordable_providers(self, quote_cap: int) -> list[tuple[Account, int]]:
        """Find actors able to add proportional liquidity to a spot pool."""
        if not self.is_spot() or self.dao_state().amm.totalLiquidity == 0:
            return []
        spot = self.dao_state().amm.state.spot
        result: list[tuple[Account, int]] = []
        for actor in self.actors:
            base_balance = token_balance(self.base_atas_by_owner[actor.pubkey])
            quote_balance = token_balance(self.quote_atas_by_owner[actor.pubkey])
            max_from_base = (
                base_balance * spot.quoteReserves // spot.baseReserves
            )
            maximum = min(quote_cap, quote_balance, max_from_base)
            if maximum > 0:
                result.append((actor, maximum))
        return result
