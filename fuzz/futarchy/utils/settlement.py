"""Snapshot assertions shared by market finalization and administrative cancellation."""

from dataclasses import replace

from ..pytypes.futarchy import Dao, PoolState, Proposal, ProposalState
from .assertions import AccountSnapshot, assert_changed_only
from .tokens import mint_supply, token_balance


def assert_market_settled(context, accounts, before: AccountSnapshot, passed: bool) -> None:
    """Check binary resolution, the winning reserve merge, and both redemptions."""
    old_dao = before.decode(context.dao, Dao)
    old_proposal = before.decode(accounts.proposal, Proposal)
    assert isinstance(old_dao.amm.state, PoolState.Futarchy)
    new_dao = context.dao_state()
    assert isinstance(new_dao.amm.state, PoolState.Spot)
    assert_changed_only(
        old_proposal,
        context.proposal_state(accounts),
        state=ProposalState.Passed() if passed else ProposalState.Failed(),
    )

    # Question layout: discriminator, id[32], oracle[32], Vec<u32>, denominator.
    old_question = before.account(accounts.question).data
    question = bytes(accounts.question.data)
    assert len(old_question) == len(question) == 88
    assert question[:72] == old_question[:72]
    assert int.from_bytes(old_question[72:76], "little") == 2
    assert old_question[76:88] == bytes(12), "question was already resolved"
    assert question[72:76] == old_question[72:76]
    payouts = [int.from_bytes(question[i : i + 4], "little") for i in (76, 80)]
    assert payouts == ([0, 1] if passed else [1, 0])
    assert int.from_bytes(question[84:88], "little") == 1

    state = old_dao.amm.state
    winner = state.pass_ if passed else state.fail
    merged = replace(
        state.spot,
        **{
            field: getattr(state.spot, field) + getattr(winner, field)
            for field in (
                "baseReserves", "quoteReserves",
                "baseProtocolFeeBalance", "quoteProtocolFeeBalance",
            )
        },
    )
    assert_changed_only(old_dao.amm, new_dao.amm, state=PoolState.Spot(merged))

    for underlying, custody, mints, vaults in (
        (
            context.amm_base_vault, accounts.base_vault_underlying,
            (accounts.fail_base_mint, accounts.pass_base_mint),
            (accounts.amm_fail_base_vault, accounts.amm_pass_base_vault),
        ),
        (
            context.amm_quote_vault, accounts.quote_vault_underlying,
            (accounts.fail_quote_mint, accounts.pass_quote_mint),
            (accounts.amm_fail_quote_vault, accounts.amm_pass_quote_vault),
        ),
    ):
        payout = before.account(vaults[int(passed)]).token_balance()
        assert token_balance(underlying) == (
            before.account(underlying).token_balance() + payout
        )
        assert token_balance(custody) == before.account(custody).token_balance() - payout
        for mint, vault in zip(mints, vaults):
            assert token_balance(vault) == 0
            assert mint_supply(mint) == (
                before.account(mint).mint_supply() - before.account(vault).token_balance()
            )
