"""Cross-instruction invariants for Futarchy AMM position accounts."""

from __future__ import annotations

from wake_sol import invariant

from ..constants import FUTARCHY_PROGRAM_ID
from ..pytypes.futarchy import AmmPosition
from ..utils.accounts import derive_amm_position


class PositionInvariants:
    """Validate PDA identity, immutable authority, and aggregate LP supply."""

    @invariant()
    def positions_sum_to_total_liquidity(self) -> None:
        """All normally created position balances equal embedded LP supply."""
        total = 0
        for authority_key, account in self.position_accounts.items():
            if not account.exists:
                continue
            authority = self.signers_by_pubkey.get(authority_key, self.council)
            expected, _ = derive_amm_position(
                self.dao, authority, FUTARCHY_PROGRAM_ID
            )
            position = AmmPosition.decode(account.data)
            assert account.pubkey == expected.pubkey
            assert account.owner == FUTARCHY_PROGRAM_ID
            assert position.dao == self.dao.pubkey
            assert position.positionAuthority == authority_key
            total += position.liquidity
        assert total == self.dao_state().amm.totalLiquidity
