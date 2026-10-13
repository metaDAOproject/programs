"""Cross-instruction invariants for proposals, markets, and stake custody."""

from __future__ import annotations

from wake_sol import invariant

from ..constants import CONDITIONAL_VAULT_PROGRAM_ID, FUTARCHY_PROGRAM_ID
from ..pytypes.futarchy import Proposal, ProposalAction, ProposalState, StakeAccount
from ..utils.accounts import (
    derive_conditional_mint,
    derive_proposal,
    derive_stake_account,
)
from ..utils.tokens import token_balance


class ProposalInvariants:
    """Validate proposal graph identity and per-proposal stake conservation."""

    @invariant()
    def proposal_account_graphs_are_canonical(self) -> None:
        """Every registered proposal and outcome mint matches its PDA links."""
        for accounts in self.proposals:
            proposal = Proposal.decode(accounts.proposal.data)
            expected, bump = derive_proposal(
                accounts.squads.proposal, FUTARCHY_PROGRAM_ID
            )
            assert accounts.proposal.pubkey == expected.pubkey
            assert accounts.proposal.owner == FUTARCHY_PROGRAM_ID
            assert proposal.pdaBump == bump
            assert proposal.dao == self.dao.pubkey
            assert proposal.squadsProposal == accounts.squads.proposal.pubkey
            assert proposal.question == accounts.question.pubkey
            assert proposal.baseVault == accounts.base_vault.pubkey
            assert proposal.quoteVault == accounts.quote_vault.pubkey
            if isinstance(
                proposal.action,
                (
                    ProposalAction.HostileTakeover,
                    ProposalAction.HostileLiquidate,
                ),
            ):
                assert proposal.sponsoredBy is None
            for vault, mints in (
                (
                    accounts.base_vault,
                    (accounts.fail_base_mint, accounts.pass_base_mint),
                ),
                (
                    accounts.quote_vault,
                    (accounts.fail_quote_mint, accounts.pass_quote_mint),
                ),
            ):
                for outcome, mint in enumerate(mints):
                    expected_mint, _ = derive_conditional_mint(
                        vault, outcome, CONDITIONAL_VAULT_PROGRAM_ID
                    )
                    assert mint.pubkey == expected_mint.pubkey

    @invariant()
    def proposal_stake_custody_is_conserved(self) -> None:
        """Stake records sum to custody; Draft's aggregate equals the same sum."""
        for accounts in self.proposals:
            total = 0
            for (proposal_key, staker_key), account in self.stake_accounts.items():
                if proposal_key != accounts.proposal.pubkey or not account.exists:
                    continue
                staker = self.signers_by_pubkey[staker_key]
                expected, bump = derive_stake_account(
                    accounts.proposal, staker, FUTARCHY_PROGRAM_ID
                )
                stake = StakeAccount.decode(account.data)
                assert account.pubkey == expected.pubkey
                assert stake.bump == bump
                assert stake.proposal == proposal_key
                assert stake.staker == staker_key
                total += stake.amount
            assert token_balance(accounts.proposal_base_account) == total
            state = self.proposal_state(accounts).state
            if isinstance(state, ProposalState.Draft):
                assert state.amountStaked == total
