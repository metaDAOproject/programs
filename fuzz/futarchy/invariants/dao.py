"""Small cross-instruction invariants for the primary DAO identity/config."""

from __future__ import annotations

from wake_sol import invariant

from ..constants import (
    FUTARCHY_PROGRAM_ID,
    MAX_PASS_THRESHOLD_BPS,
    MAX_SPENDING_LIMIT_MEMBERS,
    MAX_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
    MIN_PROPOSAL_DURATION_SECONDS,
    MIN_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
)
from ..utils.accounts import derive_dao


class DaoInvariants:
    """Validate stable PDA identity and the protocol's persistent bounds."""

    @invariant()
    def dao_identity_is_canonical(self) -> None:
        """The main DAO remains at its seed-derived, Futarchy-owned address."""
        expected, bump = derive_dao(
            self.dao_creator, self.dao_nonce, FUTARCHY_PROGRAM_ID
        )
        dao = self.dao_state()
        assert self.dao.pubkey == expected.pubkey
        assert self.dao.owner == FUTARCHY_PROGRAM_ID
        assert dao.pdaBump == bump
        assert dao.daoCreator == self.dao_creator.pubkey
        assert dao.baseMint == self.base_mint.pubkey
        assert dao.quoteMint == self.quote_mint.pubkey
        assert dao.squadsMultisig == self.squads_multisig.pubkey
        assert dao.squadsMultisigVault == self.council.pubkey
        assert dao.amm.ammBaseVault == self.amm_base_vault.pubkey
        assert dao.amm.ammQuoteVault == self.amm_quote_vault.pubkey

    @invariant()
    def dao_configuration_stays_valid(self) -> None:
        """Every successful update leaves the same bounds enforced by Rust."""
        dao = self.dao_state()
        assert dao.secondsPerProposal >= MIN_PROPOSAL_DURATION_SECONDS
        assert dao.secondsPerProposal >= 2 * dao.twapStartDelaySeconds
        assert 0 <= dao.passThresholdBps <= MAX_PASS_THRESHOLD_BPS
        assert (
            MIN_TEAM_SPONSORED_PASS_THRESHOLD_BPS
            <= dao.teamSponsoredPassThresholdBps
            <= MAX_TEAM_SPONSORED_PASS_THRESHOLD_BPS
        )
        assert dao.minBaseFutarchicLiquidity > 0
        assert dao.minQuoteFutarchicLiquidity > 0
        assert dao.twapMaxObservationChangePerUpdate > 0
        if dao.initialSpendingLimit is not None:
            limit = dao.initialSpendingLimit
            assert limit.amountPerMonth > 0
            assert 1 <= len(limit.members) <= MAX_SPENDING_LIMIT_MEMBERS
            assert len(set(limit.members)) == len(limit.members)
        if dao.liquidator is not None:
            assert dao.initialSpendingLimit is None
