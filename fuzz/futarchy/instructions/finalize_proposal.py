"""Snapshot-checked wrapper for Futarchy ``finalize_proposal``."""

from __future__ import annotations

from wake_sol import AnchorError, random, svm

from .base import InstructionWrapper
from ..constants import (
    CONDITIONAL_VAULT_PROGRAM_ID,
    FUTARCHY_PROGRAM_ID,
    MAX_BPS,
    SQUADS_PROGRAM_ID,
)
from ..pytypes.futarchy import (
    Futarchy as FutarchyProgram,
    PoolState,
    ProposalAction,
)
from ..utils.oracle import calculate_twap
from ..utils.assertions import assert_changed_only
from ..utils.settlement import assert_market_settled
from ..utils.state import ProposalAccounts


class FinalizeProposalInstruction(InstructionWrapper):
    """Check maturity, TWAP outcome, resolution, and return to Spot."""

    @staticmethod
    def assert_action_side_effects(
        before_dao,
        after_dao,
        action,
        should_pass: bool,
        now: int,
    ) -> None:
        """Check the direct DAO writes performed by finalization."""
        expected_liquidator = before_dao.liquidator
        expected_spending_limit = before_dao.initialSpendingLimit
        expected_spending_limit_dirty = before_dao.spendingLimitDirty
        expected_failed_takeover_at = before_dao.lastFailedTakeoverAt
        expected_failed_liquidation_at = before_dao.lastFailedLiquidationAt
        expected_buyback_finalized_at = before_dao.lastBuybackFinalizedAt

        if isinstance(action, ProposalAction.HostileTakeover) and not should_pass:
            expected_failed_takeover_at = now
        elif isinstance(action, ProposalAction.HostileLiquidate):
            if should_pass:
                expected_liquidator = action.liquidator
                if expected_spending_limit is not None:
                    expected_spending_limit = None
                    expected_spending_limit_dirty = True
            else:
                expected_failed_liquidation_at = now
        elif isinstance(action, ProposalAction.BuybackToken):
            expected_buyback_finalized_at = now

        assert_changed_only(
            before_dao, after_dao,
            amm=after_dao.amm, seqNum=before_dao.seqNum + 1,
            liquidator=expected_liquidator,
            initialSpendingLimit=expected_spending_limit,
            spendingLimitDirty=expected_spending_limit_dirty,
            lastFailedTakeoverAt=expected_failed_takeover_at,
            lastFailedLiquidationAt=expected_failed_liquidation_at,
            lastBuybackFinalizedAt=expected_buyback_finalized_at,
        )

    def build_instruction(self, accounts: ProposalAccounts):
        context = self.context
        context.market_support.ensure_launch_accounts(accounts)
        return FutarchyProgram.finalizeProposal(
            proposal=accounts.proposal,
            dao=context.dao,
            question=accounts.question,
            squadsProposal=accounts.squads.proposal,
            squadsMultisig=context.squads_multisig,
            squadsMultisigProgram=SQUADS_PROGRAM_ID,
            ammPassBaseVault=accounts.amm_pass_base_vault,
            ammPassQuoteVault=accounts.amm_pass_quote_vault,
            ammFailBaseVault=accounts.amm_fail_base_vault,
            ammFailQuoteVault=accounts.amm_fail_quote_vault,
            ammBaseVault=context.amm_base_vault,
            ammQuoteVault=context.amm_quote_vault,
            vaultProgram=CONDITIONAL_VAULT_PROGRAM_ID,
            vaultEventAuthority=context.vault_event_authority,
            quoteVault=accounts.quote_vault,
            quoteVaultUnderlyingTokenAccount=accounts.quote_vault_underlying,
            passQuoteMint=accounts.pass_quote_mint,
            failQuoteMint=accounts.fail_quote_mint,
            passBaseMint=accounts.pass_base_mint,
            failBaseMint=accounts.fail_base_mint,
            baseVault=accounts.base_vault,
            baseVaultUnderlyingTokenAccount=accounts.base_vault_underlying,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def can_happy(self) -> bool:
        return bool(self.context.finalizable_proposals())

    def happy(self) -> None:
        """Finalize one mature market and independently verify its outcome."""
        context = self.context
        finalizable = context.finalizable_proposals()
        liquidations = [
            proposal
            for proposal in finalizable
            if isinstance(
                context.proposal_state(proposal).action,
                ProposalAction.HostileLiquidate,
            )
        ]
        accounts = random.choice(liquidations or finalizable)
        before_dao = context.dao_state()
        before_proposal = context.proposal_state(accounts)
        assert isinstance(before_dao.amm.state, PoolState.Futarchy)
        now = svm.clock.unix_timestamp
        pass_twap = calculate_twap(before_dao.amm.state.pass_.oracle, now)
        fail_twap = calculate_twap(before_dao.amm.state.fail.oracle, now)
        threshold = (
            fail_twap * (MAX_BPS + before_proposal.passThresholdBps) // MAX_BPS
        )
        should_pass = pass_twap > threshold
        instruction = self.build_instruction(accounts)
        before = self.snapshot(instruction)
        context.payer.tx(self.compute_unit_limit(), instruction)
        after_dao = context.dao_state()
        assert_market_settled(context, accounts, before, should_pass)
        self.assert_action_side_effects(
            before_dao,
            after_dao,
            before_proposal.action,
            should_pass,
            now,
        )
        context.squads.assert_proposal_status(
            accounts.squads,
            "Approved" if should_pass else "Rejected",
        )
        if should_pass:
            accounts.squads.approved = True
            if isinstance(
                before_proposal.action,
                ProposalAction.HostileLiquidate,
            ):
                assert (
                    context.enqueue_authority().pubkey
                    == before_proposal.action.liquidator
                )
        else:
            accounts.squads.rejected = True

    def negative_candidates(self):
        context = self.context
        if not context.pending_proposals():
            return []
        now = svm.clock.unix_timestamp
        result = []
        state = context.dao_state().amm.state
        assert isinstance(state, PoolState.Futarchy)
        twaps_started = all(
            pool.oracle.lastUpdatedTimestamp
            > pool.oracle.createdAtTimestamp + pool.oracle.startDelaySeconds
            for pool in (state.pass_, state.fail)
        )
        for accounts in context.pending_proposals():
            proposal = context.proposal_state(accounts)
            if now < proposal.timestampEnqueued + proposal.durationInSeconds:
                result.append((accounts, FutarchyProgram.ProposalTooYoung))
            elif not twaps_started:
                result.append((accounts, FutarchyProgram.MarketsTooYoung))
            elif any(
                pool.oracle.aggregator == 0 for pool in (state.pass_, state.fail)
            ):
                result.append((accounts, AnchorError.RequireNeqViolated))
        return result

    def can_unhappy(self) -> bool:
        return bool(self.negative_candidates())

    def unhappy(self) -> None:
        """Reject a too-young or uncranked market and prove full CPI rollback."""
        accounts, expected = random.choice(self.negative_candidates())
        instruction = self.build_instruction(accounts)
        self.assert_fails_atomically(
            self.context.payer,
            instruction,
            expected,
            before=(self.compute_unit_limit(),),
        )
