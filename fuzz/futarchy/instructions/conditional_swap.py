"""Snapshot-checked wrapper for Futarchy ``conditional_swap``."""

from __future__ import annotations

from wake_sol import Account, AnchorError, random, svm

from .base import InstructionWrapper
from ..constants import (
    CONDITIONAL_VAULT_PROGRAM_ID,
    FUTARCHY_PROGRAM_ID,
    TOKEN_SCALE,
    TWAP_UPDATE_INTERVAL_SECONDS,
)
from ..pytypes.futarchy import (
    ConditionalSwapParams,
    Futarchy as FutarchyProgram,
    Market,
    PoolState,
    ProposalAction,
    SwapType,
)
from ..utils.swaps import assert_swap_transition
from ..utils.state import ProposalAccounts
from ..utils.tokens import token_balance


class ConditionalSwapInstruction(InstructionWrapper):
    """Check conditional user transfers and all three reserve products."""

    @staticmethod
    def build_params(
        market: Market,
        direction: SwapType,
        amount: int,
        minimum_output: int = 0,
    ) -> ConditionalSwapParams:
        return ConditionalSwapParams(
            market=market,
            swapType=direction,
            inputAmount=amount,
            minOutputAmount=minimum_output,
        )

    @staticmethod
    def user_accounts(
        proposal: ProposalAccounts,
        trader: Account,
        market: Market,
        direction: SwapType,
    ) -> tuple[Account, Account]:
        pass_market = market == Market.Pass
        base_mint = proposal.pass_base_mint if pass_market else proposal.fail_base_mint
        quote_mint = (
            proposal.pass_quote_mint if pass_market else proposal.fail_quote_mint
        )
        base = proposal.conditional_accounts[(trader.pubkey, base_mint.pubkey)]
        quote = proposal.conditional_accounts[(trader.pubkey, quote_mint.pubkey)]
        return (quote, base) if direction == SwapType.Buy else (base, quote)

    def build_instruction(
        self,
        proposal: ProposalAccounts,
        trader: Account,
        input_account: Account,
        output_account: Account,
        params: ConditionalSwapParams,
    ):
        context = self.context
        context.market_support.ensure_launch_accounts(proposal)
        return FutarchyProgram.conditionalSwap(
            params,
            dao=context.dao,
            ammBaseVault=context.amm_base_vault,
            ammQuoteVault=context.amm_quote_vault,
            proposal=proposal.proposal,
            ammPassBaseVault=proposal.amm_pass_base_vault,
            ammPassQuoteVault=proposal.amm_pass_quote_vault,
            ammFailBaseVault=proposal.amm_fail_base_vault,
            ammFailQuoteVault=proposal.amm_fail_quote_vault,
            trader=trader,
            userInputAccount=input_account,
            userOutputAccount=output_account,
            baseVault=proposal.base_vault,
            baseVaultUnderlyingTokenAccount=proposal.base_vault_underlying,
            quoteVault=proposal.quote_vault,
            quoteVaultUnderlyingTokenAccount=proposal.quote_vault_underlying,
            passBaseMint=proposal.pass_base_mint,
            failBaseMint=proposal.fail_base_mint,
            passQuoteMint=proposal.pass_quote_mint,
            failQuoteMint=proposal.fail_quote_mint,
            conditionalVaultProgram=CONDITIONAL_VAULT_PROGRAM_ID,
            vaultEventAuthority=context.vault_event_authority,
            question=proposal.question,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def can_happy(self) -> bool:
        return not self.context.is_liquidated() and bool(self.available_trades())

    def available_trades(
        self,
    ) -> list[tuple[ProposalAccounts, Account, Market, SwapType]]:
        """Find trades that can obtain a positive conditional-token input."""
        context = self.context
        result: list[tuple[ProposalAccounts, Account, Market, SwapType]] = []
        for proposal in context.pending_proposals():
            action = context.proposal_state(proposal).action
            choices = (
                ((Market.Pass, SwapType.Buy), (Market.Fail, SwapType.Sell))
                if isinstance(action, ProposalAction.HostileLiquidate)
                else tuple(
                    (market, direction)
                    for market in (Market.Pass, Market.Fail)
                    for direction in (SwapType.Buy, SwapType.Sell)
                )
            )
            for trader in context.actors:
                for market, direction in choices:
                    pass_market = market == Market.Pass
                    mint = (
                        proposal.pass_quote_mint
                        if pass_market and direction == SwapType.Buy
                        else proposal.fail_quote_mint
                        if direction == SwapType.Buy
                        else proposal.pass_base_mint
                        if pass_market
                        else proposal.fail_base_mint
                    )
                    conditional = proposal.conditional_accounts.get(
                        (trader.pubkey, mint.pubkey)
                    )
                    underlying = (
                        context.quote_atas_by_owner[trader.pubkey]
                        if direction == SwapType.Buy
                        else context.base_atas_by_owner[trader.pubkey]
                    )
                    if (
                        conditional is not None
                        and conditional.exists
                        and token_balance(conditional) > 0
                    ) or token_balance(underlying) > 0:
                        result.append((proposal, trader, market, direction))
        return result

    def prepare_positive_trade(
        self,
    ) -> tuple[
        ProposalAccounts,
        Account,
        Market,
        SwapType,
        Account,
        Account,
    ]:
        """Select and fund one trade, then require a positive input balance."""
        proposal, trader, market, direction = random.choice(
            self.available_trades()
        )
        self.context.market_support.ensure_trader_tokens(proposal, trader)
        input_account, output_account = self.user_accounts(
            proposal, trader, market, direction
        )
        assert token_balance(input_account) > 0
        return (
            proposal,
            trader,
            market,
            direction,
            input_account,
            output_account,
        )

    def happy(self) -> None:
        """Trade pass/fail tokens and verify the observed output transition."""
        context = self.context
        (
            proposal,
            trader,
            market,
            direction,
            input_account,
            output_account,
        ) = self.prepare_positive_trade()
        action = context.proposal_state(proposal).action
        maximum = min(
            token_balance(input_account),
            (1_000 if isinstance(action, ProposalAction.HostileLiquidate) else 100)
            * TOKEN_SCALE,
        )
        amount = (
            maximum
            if isinstance(action, ProposalAction.HostileLiquidate)
            else random.randint(1, maximum)
        )
        params = self.build_params(market, direction, amount)
        instruction = self.build_instruction(
            proposal, trader, input_account, output_account, params
        )
        if isinstance(action, ProposalAction.HostileLiquidate):
            svm.warp_to_timestamp(
                svm.clock.unix_timestamp + TWAP_UPDATE_INTERVAL_SECONDS
            )
        before_dao = context.dao_state()
        timestamp = svm.clock.unix_timestamp
        before = self.snapshot(
            instruction,
            extra_accounts=(context.dao, input_account, output_account),
        )
        trader.tx(self.compute_unit_limit(), instruction)
        after_dao = context.dao_state()
        assert token_balance(input_account) == (
            before.account(input_account).token_balance() - amount
        )
        output = token_balance(output_account) - before.account(
            output_account
        ).token_balance()
        assert output >= params.minOutputAmount
        assert isinstance(before_dao.amm.state, PoolState.Futarchy)
        assert isinstance(after_dao.amm.state, PoolState.Futarchy)
        assert_swap_transition(
            before_dao, after_dao, market, direction, amount, output, timestamp
        )

    def can_unhappy(self) -> bool:
        return self.can_happy()

    def unhappy(self) -> None:
        """Reject Spot selection or positive impossible slippage atomically."""
        context = self.context
        (
            proposal,
            trader,
            market,
            direction,
            input_account,
            output_account,
        ) = self.prepare_positive_trade()
        amount = random.randint(
            1, min(token_balance(input_account), 100 * TOKEN_SCALE)
        )
        if random.choice((False, True)):
            params = self.build_params(Market.Spot, direction, amount)
            expected = AnchorError.RequireNeqViolated
        else:
            params = self.build_params(
                market, direction, amount, 2**64 - 1
            )
            expected = FutarchyProgram.SwapSlippageExceeded
        instruction = self.build_instruction(
            proposal, trader, input_account, output_account, params
        )
        self.assert_fails_atomically(
            trader,
            instruction,
            expected,
            before=(self.compute_unit_limit(),),
        )
