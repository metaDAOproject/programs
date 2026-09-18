"""Global token conservation and backing in both AMM states."""

from __future__ import annotations

from wake_sol import invariant

from ..pytypes.futarchy import PoolState
from ..utils.tokens import mint_supply, token_account_fields, token_balance


class TokenInvariants:
    """Validate physical token ledgers independently from wrapper snapshots."""

    def _assert_supply(self, mint, accounts) -> None:
        total = 0
        for account in accounts.values():
            if not account.exists:
                continue
            account_mint, _, amount = token_account_fields(account)
            assert account_mint == mint.pubkey
            total += amount
        assert total == mint_supply(mint)

    @invariant()
    def underlying_token_supplies_are_conserved(self) -> None:
        """Every base/quote atom is present in a registered token account."""
        self._assert_supply(self.base_mint, self.base_token_accounts)
        self._assert_supply(self.quote_mint, self.quote_token_accounts)

    @invariant()
    def spot_reserves_and_fees_are_fully_backed(self) -> None:
        """In Spot state, each AMM vault equals reserves plus protocol fees."""
        state = self.dao_state().amm.state
        if not isinstance(state, PoolState.Spot):
            return
        assert token_balance(self.amm_base_vault) == (
            state.spot.baseReserves + state.spot.baseProtocolFeeBalance
        )
        assert token_balance(self.amm_quote_vault) == (
            state.spot.quoteReserves + state.spot.quoteProtocolFeeBalance
        )

    @invariant()
    def conditional_reserves_and_fees_are_fully_backed(self) -> None:
        """Each virtual outcome claim is backed by underlying plus that outcome.

        Exact equality assumes this fixture's absence of direct vault donations.
        Launch divides reserves virtually; it does not split physical tokens.
        """
        state = self.dao_state().amm.state
        pending = self.pending_proposals()
        if isinstance(state, PoolState.Spot):
            assert not pending
            return
        assert len(pending) == 1
        accounts = pending[0]
        for pool, base, quote in (
            (state.pass_, accounts.amm_pass_base_vault, accounts.amm_pass_quote_vault),
            (state.fail, accounts.amm_fail_base_vault, accounts.amm_fail_quote_vault),
        ):
            for side, underlying, conditional in (
                ("base", self.amm_base_vault, base),
                ("quote", self.amm_quote_vault, quote),
            ):
                liability = sum(
                    getattr(part, side + suffix)
                    for part in (state.spot, pool)
                    for suffix in ("Reserves", "ProtocolFeeBalance")
                )
                assert liability == (
                    token_balance(underlying) + token_balance(conditional)
                )

    @invariant()
    def conditional_token_supplies_are_backed(self) -> None:
        """Track both claim ledgers and their unresolved/resolved collateral."""
        for accounts in self.proposals:
            question = bytes(accounts.question.data)
            payouts = [int.from_bytes(question[i : i + 4], "little") for i in (76, 80)]
            denominator = int.from_bytes(question[84:88], "little")
            for custody, mints, vaults in (
                (
                    accounts.base_vault_underlying,
                    (accounts.fail_base_mint, accounts.pass_base_mint),
                    (accounts.amm_fail_base_vault, accounts.amm_pass_base_vault),
                ),
                (
                    accounts.quote_vault_underlying,
                    (accounts.fail_quote_mint, accounts.pass_quote_mint),
                    (accounts.amm_fail_quote_vault, accounts.amm_pass_quote_vault),
                ),
            ):
                supplies = []
                for mint, vault in zip(mints, vaults):
                    holders = {
                        account.pubkey: account
                        for (_, mint_key), account in accounts.conditional_accounts.items()
                        if mint_key == mint.pubkey
                    }
                    if vault is not None:
                        holders[vault.pubkey] = vault
                    self._assert_supply(mint, holders)
                    supplies.append(mint_supply(mint))
                liability = (
                    max(supplies)
                    if denominator == 0
                    else sum(supply * payout for supply, payout in zip(supplies, payouts))
                    // denominator
                )
                assert token_balance(custody) >= liability
