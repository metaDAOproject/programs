"""Snapshot-checked wrapper for vault-signed Futarchy ``update_dao``."""

from __future__ import annotations

from typing import Any

from wake_sol import Account, random

from .base import InstructionWrapper
from ..constants import (
    EXECUTE_ARBITRARY_DURATION_SECONDS,
    FUTARCHY_PROGRAM_ID,
    MAX_PASS_THRESHOLD_BPS,
    MAX_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
    MIN_PROPOSAL_DURATION_SECONDS,
    MIN_QUOTE_LIQUIDITY,
    MIN_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
    TOKEN_SCALE,
    V08_LAUNCH_PRICE,
    V08_PASS_THRESHOLD_BPS,
    V08_SECONDS_PER_PROPOSAL,
    V08_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
    V08_TWAP_START_DELAY_SECONDS,
    V08_TWAP_MAX_CHANGE,
)
from ..pytypes.futarchy import Futarchy as FutarchyProgram, UpdateDaoParams
from ..utils.assertions import assert_changed_only


class UpdateDaoInstruction(InstructionWrapper):
    """Execute via Squads and verify supplied fields replace only themselves."""

    @staticmethod
    def build_params(**updates: Any) -> UpdateDaoParams:
        """Build all optional fields, defaulting omitted values to ``None``."""
        names = (
            "passThresholdBps",
            "secondsPerProposal",
            "twapInitialObservation",
            "twapMaxObservationChangePerUpdate",
            "twapStartDelaySeconds",
            "minQuoteFutarchicLiquidity",
            "minBaseFutarchicLiquidity",
            "baseToStake",
            "teamSponsoredPassThresholdBps",
            "teamAddress",
        )
        return UpdateDaoParams(**{name: updates.get(name) for name in names})

    def build_instruction(
        self,
        params: UpdateDaoParams,
        signer_account: Account | None = None,
    ):
        context = self.context
        return FutarchyProgram.updateDao(
            params,
            dao=context.dao,
            squadsMultisigVault=signer_account or context.council,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def can_happy(self) -> bool:
        return not self.context.is_liquidated() and self.context.is_spot()

    def happy(self) -> None:
        """Apply one valid configuration change through normal Squads execution."""
        context = self.context
        current = context.dao_state()
        minimum_duration = max(
            MIN_PROPOSAL_DURATION_SECONDS,
            2 * current.twapStartDelaySeconds,
        )
        maximum_delay = current.secondsPerProposal // 2
        values = {
            "passThresholdBps": random.choice(
                (0, V08_PASS_THRESHOLD_BPS, MAX_PASS_THRESHOLD_BPS)
            ),
            "secondsPerProposal": random.choice(
                (
                    minimum_duration,
                    max(minimum_duration, V08_SECONDS_PER_PROPOSAL),
                    max(minimum_duration, EXECUTE_ARBITRARY_DURATION_SECONDS),
                )
            ),
            "twapInitialObservation": random.choice((0, V08_LAUNCH_PRICE)),
            "twapMaxObservationChangePerUpdate": random.choice(
                (1, V08_TWAP_MAX_CHANGE)
            ),
            "twapStartDelaySeconds": random.choice(
                (
                    0,
                    min(V08_TWAP_START_DELAY_SECONDS, maximum_delay),
                    maximum_delay,
                )
            ),
            "minQuoteFutarchicLiquidity": random.choice(
                (1, MIN_QUOTE_LIQUIDITY)
            ),
            "minBaseFutarchicLiquidity": random.choice(
                (1, TOKEN_SCALE, 10 * TOKEN_SCALE)
            ),
            "baseToStake": random.choice(
                (0, 100_000 * TOKEN_SCALE, 1_500_000 * TOKEN_SCALE)
            ),
            "teamSponsoredPassThresholdBps": random.choice(
                (
                    MIN_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
                    V08_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
                    MAX_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
                )
            ),
            "teamAddress": random.choice(context.team_candidates).pubkey,
        }
        selected = random.choice(tuple(values))
        params = self.build_params(**{selected: values[selected]})
        inner = self.build_instruction(params)
        prepared = context.squads.prepare_and_approve(
            inner, purpose=f"update DAO {selected}"
        )
        before = context.dao_state()
        context.squads.execute_top_level(prepared)
        after = context.dao_state()
        assert_changed_only(
            before, after, seqNum=before.seqNum + 1, **{selected: values[selected]}
        )

    def can_unhappy(self) -> bool:
        return not self.context.is_liquidated() and self.context.is_spot()

    def unhappy(self) -> None:
        """Reject a pass threshold above the DAO invariant and prove rollback."""
        context = self.context
        params = self.build_params(
            passThresholdBps=MAX_PASS_THRESHOLD_BPS + 1
        )
        inner = self.build_instruction(params)
        prepared = context.squads.prepare_and_approve(
            inner, purpose="invalid DAO threshold"
        )
        execute = context.squads.build_execute(prepared)
        self.assert_fails_atomically(
            context.payer,
            execute,
            FutarchyProgram.PassThresholdTooHigh,
            before=(context.squads.compute_unit_limit(),),
            signers=(context.permissionless_account,),
            extra_accounts=(context.dao,),
        )
        prepared.disabled = True
