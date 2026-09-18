"""Snapshot-checked wrapper for Futarchy ``launch_proposal``."""

from __future__ import annotations

from wake_sol import Account, random, svm

from .base import InstructionWrapper
from ..constants import (
    FLOWS_COUNT,
    FUTARCHY_PROGRAM_ID,
    LIQUIDATION_FLOW_FRACTION,
    PRICE_SCALE,
    U128_MAX,
)
from ..pytypes.futarchy import (
    Futarchy as FutarchyProgram,
    PoolState,
    Proposal,
    ProposalAction,
    ProposalState,
)
from ..utils.state import ProposalAccounts
from ..utils.assertions import assert_changed_only
from ..utils.oracle import assert_initial_oracle
from ..utils.proposals import (
    is_currently_sponsored,
    proposal_kind_expectation,
)
from ..utils.squads import decode_squads_proposal
from ..utils.tokens import token_balance


class LaunchProposalInstruction(InstructionWrapper):
    """Check Draft gates and the exact Spot-to-Futarchy reserve split."""

    @staticmethod
    def requires_sponsorship(action) -> bool:
        return proposal_kind_expectation(action).sponsorship == "required"

    def liquidation_lane_open(self) -> bool:
        """Delay the terminal proposal until ordinary flows have had coverage."""
        return self.context.flow_num >= int(
            FLOWS_COUNT * LIQUIDATION_FLOW_FRACTION
        )

    def treasury_quote_value(self) -> int:
        """Value the supplied treasury quote account and council LP position."""
        context = self.context
        dao = context.dao_state()
        value = token_balance(context.council_quote_account)
        position = context.position_accounts.get(context.council.pubkey)
        if position is None or not position.exists or dao.amm.totalLiquidity == 0:
            return value
        from ..pytypes.futarchy import AmmPosition

        decoded = AmmPosition.decode(position.data)
        spot = dao.amm.state.spot
        observed_quote = min(
            spot.quoteReserves,
            min(U128_MAX, spot.baseReserves * spot.oracle.lastObservation) // PRICE_SCALE,
        )
        return value + decoded.liquidity * observed_quote // dao.amm.totalLiquidity

    def has_minimum_market_liquidity(self) -> bool:
        """Return whether each half-pool meets the current DAO launch floor."""
        context = self.context
        if not context.is_spot():
            return False
        dao = context.dao_state()
        spot = dao.amm.state.spot
        return (
            spot.baseReserves // 2 >= dao.minBaseFutarchicLiquidity
            and spot.quoteReserves // 2 >= dao.minQuoteFutarchicLiquidity
        )

    @staticmethod
    def squads_status(accounts: ProposalAccounts) -> str:
        """Read the real Squads proposal status used by the launch guard."""
        return decode_squads_proposal(accounts.squads.proposal.data).status

    @staticmethod
    def cooldown_started_at(action, dao) -> int | None:
        if isinstance(action, ProposalAction.HostileTakeover):
            return dao.lastFailedTakeoverAt
        if isinstance(action, ProposalAction.HostileLiquidate):
            return dao.lastFailedLiquidationAt
        if isinstance(action, ProposalAction.BuybackToken):
            return dao.lastBuybackFinalizedAt
        return None

    def launchable(self) -> list[ProposalAccounts]:
        context = self.context
        if (
            context.is_liquidated()
            or not context.is_spot()
            or not self.has_minimum_market_liquidity()
        ):
            return []
        dao = context.dao_state()
        now = svm.clock.unix_timestamp
        result: list[ProposalAccounts] = []
        for accounts in context.draft_proposals():
            proposal = context.proposal_state(accounts)
            assert isinstance(proposal.state, ProposalState.Draft)
            sponsored = is_currently_sponsored(proposal, dao)
            if (
                not sponsored
                and proposal.state.amountStaked < dao.baseToStake
            ):
                continue
            if (
                self.requires_sponsorship(proposal.action)
                and not sponsored
            ):
                continue
            expectation = proposal_kind_expectation(proposal.action)
            if proposal.durationInSeconds <= expectation.twap_start_delay_seconds:
                continue
            cooldown_started_at = self.cooldown_started_at(proposal.action, dao)
            if (
                cooldown_started_at is not None
                and now < cooldown_started_at + expectation.cooldown_seconds
            ):
                continue
            if self.squads_status(accounts) != "Active":
                continue
            if isinstance(proposal.action, ProposalAction.HostileLiquidate):
                if not self.liquidation_lane_open():
                    continue
            elif isinstance(proposal.action, ProposalAction.BuybackToken):
                if self.treasury_quote_value() < proposal.action.quoteAmount * 4:
                    continue
            elif isinstance(proposal.action, ProposalAction.LargeSpend):
                limit = dao.initialSpendingLimit
                if limit is None:
                    continue
                if proposal.action.amount > min(
                    limit.amountPerMonth * 3, 2**64 - 1
                ):
                    continue
                if proposal.action.teamAddress != dao.teamAddress:
                    continue
            result.append(accounts)
        return result

    def default_remaining(self, proposal: ProposalAccounts) -> tuple[Account, ...]:
        action = self.context.proposal_state(proposal).action
        if isinstance(action, ProposalAction.BuybackToken):
            accounts = [self.context.council_quote_account]
            position = self.context.position_accounts.get(
                self.context.council.pubkey
            )
            if position is not None and position.exists:
                accounts.append(position)
            return tuple(sorted(accounts, key=lambda account: bytes(account.pubkey)))
        return ()

    def build_instruction(
        self,
        proposal: ProposalAccounts,
        *,
        remaining: tuple[Account, ...] | None = None,
    ):
        context = self.context
        context.market_support.ensure_launch_accounts(proposal)
        return FutarchyProgram.launchProposal(
            proposal=proposal.proposal,
            baseVault=proposal.base_vault,
            quoteVault=proposal.quote_vault,
            passBaseMint=proposal.pass_base_mint,
            passQuoteMint=proposal.pass_quote_mint,
            failBaseMint=proposal.fail_base_mint,
            failQuoteMint=proposal.fail_quote_mint,
            dao=context.dao,
            payer=context.payer,
            ammPassBaseVault=proposal.amm_pass_base_vault,
            ammPassQuoteVault=proposal.amm_pass_quote_vault,
            ammFailBaseVault=proposal.amm_fail_base_vault,
            ammFailQuoteVault=proposal.amm_fail_quote_vault,
            squadsMultisig=context.squads_multisig,
            squadsProposal=proposal.squads.proposal,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
            remaining_accounts=(
                self.default_remaining(proposal)
                if remaining is None
                else remaining
            ),
        )

    def can_happy(self) -> bool:
        return bool(self.launchable())

    def happy(self) -> None:
        """Launch one eligible Draft and validate both conditional pools."""
        context = self.context
        launchable = self.launchable()
        liquidations = [
            proposal
            for proposal in launchable
            if isinstance(
                context.proposal_state(proposal).action,
                ProposalAction.HostileLiquidate,
            )
        ]
        accounts = random.choice(liquidations or launchable)
        before_dao = context.dao_state()
        before_proposal = context.proposal_state(accounts)
        assert isinstance(before_dao.amm.state, PoolState.Spot)
        old_spot = before_dao.amm.state.spot
        if isinstance(before_proposal.action, ProposalAction.BuybackToken):
            amount = before_proposal.action.quoteAmount
            assert amount * 4 <= self.treasury_quote_value()
            if amount * 4 > context.council_quote_balance():
                self.assert_fails_atomically(
                    context.payer,
                    self.build_instruction(
                        accounts, remaining=(context.council_quote_account,)
                    ),
                    FutarchyProgram.BuybackCapExceeded,
                    before=(self.compute_unit_limit(),),
                )
        instruction = self.build_instruction(accounts)
        context.payer.tx(self.compute_unit_limit(), instruction)
        after_dao = context.dao_state()
        after_proposal = Proposal.decode(accounts.proposal.data)
        assert isinstance(after_dao.amm.state, PoolState.Futarchy)
        assert_changed_only(
            before_dao, after_dao, amm=after_dao.amm, seqNum=before_dao.seqNum + 1
        )
        assert_changed_only(before_dao.amm, after_dao.amm, state=after_dao.amm.state)
        assert_changed_only(
            before_proposal,
            after_proposal,
            state=ProposalState.Pending(),
            timestampEnqueued=svm.clock.unix_timestamp,
        )
        context.squads.assert_proposal_status(accounts.squads, "Active")
        base_half = old_spot.baseReserves // 2
        quote_half = old_spot.quoteReserves // 2
        assert_changed_only(
            old_spot, after_dao.amm.state.spot,
            baseReserves=old_spot.baseReserves - base_half,
            quoteReserves=old_spot.quoteReserves - quote_half,
        )
        for pool in (after_dao.amm.state.pass_, after_dao.amm.state.fail):
            assert pool.baseReserves == base_half
            assert pool.quoteReserves == quote_half
            assert pool.baseProtocolFeeBalance == 0
            assert pool.quoteProtocolFeeBalance == 0
            assert_initial_oracle(
                pool.oracle,
                before_dao,
                svm.clock.unix_timestamp,
                proposal_kind_expectation(before_proposal.action).twap_start_delay_seconds,
            )
        for account in (
            accounts.amm_pass_base_vault,
            accounts.amm_pass_quote_vault,
            accounts.amm_fail_base_vault,
            accounts.amm_fail_quote_vault,
        ):
            assert account is not None and account.exists

    def negative_candidates(self):
        context = self.context
        if not context.proposals:
            return []
        dao = context.dao_state()
        now = svm.clock.unix_timestamp
        result = []
        for accounts in context.draft_proposals():
            proposal = context.proposal_state(accounts)
            assert isinstance(proposal.state, ProposalState.Draft)
            if context.is_liquidated():
                result.append((accounts, FutarchyProgram.DaoLiquidated, None))
                continue
            sponsored = is_currently_sponsored(proposal, dao)
            if (
                not sponsored
                and proposal.state.amountStaked < dao.baseToStake
            ):
                result.append(
                    (
                        accounts,
                        FutarchyProgram.InsufficientStakeToLaunch,
                        None,
                    )
                )
            elif (
                self.requires_sponsorship(proposal.action)
                and not sponsored
            ):
                result.append(
                    (accounts, FutarchyProgram.ProposalNotTeamSponsored, None)
                )
            else:
                expectation = proposal_kind_expectation(proposal.action)
                if (
                    proposal.durationInSeconds
                    <= expectation.twap_start_delay_seconds
                ):
                    result.append(
                        (
                            accounts,
                            FutarchyProgram.ProposalDurationTooShort,
                            None,
                        )
                    )
                    continue
                cooldown_started_at = self.cooldown_started_at(
                    proposal.action, dao
                )
                if (
                    cooldown_started_at is not None
                    and now
                    < cooldown_started_at + expectation.cooldown_seconds
                ):
                    result.append(
                        (
                            accounts,
                            FutarchyProgram.ProposalKindCooldownActive,
                            None,
                        )
                    )
                    continue
                if self.squads_status(accounts) != "Active":
                    result.append(
                        (
                            accounts,
                            FutarchyProgram.InvalidSquadsProposalStatus,
                            None,
                        )
                    )
                    continue

                valid_action_accounts = True
                if isinstance(proposal.action, ProposalAction.LargeSpend):
                    limit = dao.initialSpendingLimit
                    if limit is None:
                        result.append(
                            (accounts, FutarchyProgram.NoSpendingLimit, None)
                        )
                        valid_action_accounts = False
                    elif proposal.action.amount > min(
                        limit.amountPerMonth * 3, 2**64 - 1
                    ):
                        result.append(
                            (accounts, FutarchyProgram.SpendCapExceeded, None)
                        )
                        valid_action_accounts = False
                    elif proposal.action.teamAddress != dao.teamAddress:
                        result.append(
                            (accounts, FutarchyProgram.StaleTeamAddress, None)
                        )
                        valid_action_accounts = False
                    else:
                        result.append(
                            (
                                accounts,
                                FutarchyProgram.UnexpectedLaunchAccounts,
                                (context.outsider,),
                            )
                        )
                elif isinstance(proposal.action, ProposalAction.BuybackToken):
                    if not context.is_spot():
                        result.append(
                            (
                                accounts,
                                FutarchyProgram.PoolNotInSpotState,
                                None,
                            )
                        )
                        continue
                    result.extend(
                        (
                            (accounts, FutarchyProgram.BuybackCapExceeded, ()),
                            (
                                accounts,
                                FutarchyProgram.InvalidTreasuryAccount,
                                (context.outsider,),
                            ),
                            (
                                accounts,
                                FutarchyProgram.TreasuryAccountsNotSorted,
                                (
                                    context.council_quote_account,
                                    context.council_quote_account,
                                ),
                            ),
                        )
                    )
                    valid_action_accounts = (
                        self.treasury_quote_value()
                        >= proposal.action.quoteAmount * 4
                    )
                    if not valid_action_accounts:
                        result.append(
                            (
                                accounts,
                                FutarchyProgram.BuybackCapExceeded,
                                self.default_remaining(accounts),
                            )
                        )
                    elif (
                        context.council_quote_balance() < proposal.action.quoteAmount * 4
                    ):
                        result.append(
                            (
                                accounts,
                                FutarchyProgram.BuybackCapExceeded,
                                (context.council_quote_account,),
                            )
                        )
                else:
                    result.append(
                        (
                            accounts,
                            FutarchyProgram.UnexpectedLaunchAccounts,
                            (context.outsider,),
                        )
                    )

                if not valid_action_accounts:
                    continue
                valid_remaining = self.default_remaining(accounts)
                if not context.is_spot():
                    result.append(
                        (
                            accounts,
                            FutarchyProgram.PoolNotInSpotState,
                            valid_remaining,
                        )
                    )
                elif not self.has_minimum_market_liquidity():
                    result.append(
                        (
                            accounts,
                            FutarchyProgram.InsufficientLiquidity,
                            valid_remaining,
                        )
                    )
        return result

    def can_unhappy(self) -> bool:
        return bool(self.negative_candidates())

    def unhappy(self) -> None:
        """Reject one unsatisfied launch gate and prove no accounts are created."""
        launchable = self.launchable()
        if launchable and random.choice((False, False, True)):
            accounts = random.choice(launchable)
            self.context.squads.approve_for_dependency(accounts.squads)
            expected = FutarchyProgram.InvalidSquadsProposalStatus
            remaining = self.default_remaining(accounts)
        else:
            accounts, expected, remaining = random.choice(
                self.negative_candidates()
            )
        instruction = self.build_instruction(accounts, remaining=remaining)
        self.assert_fails_atomically(
            self.context.payer,
            instruction,
            expected,
            before=(self.compute_unit_limit(),),
        )
