"""Wrapper for ``initialize_hostile_takeover_proposal``."""

from __future__ import annotations

from wake_sol import Instruction, random

from .typed_initialize import TypedInitializeInstruction
from ..pytypes.futarchy import (
    Futarchy as FutarchyProgram,
    InitializeHostileTakeoverProposalArgs,
    ProposalAction,
    SetSpendingLimitArgs,
    SpendingLimitAction,
    UpdateDaoParams,
)
from ..utils.parameters import invalid_spending_limit, valid_spending_limit


class InitializeHostileTakeoverProposalInstruction(TypedInitializeInstruction):
    """Validate the declared team takeover and optional spending-limit action."""

    kind_name = "hostile takeover"

    def happy_args(self) -> InitializeHostileTakeoverProposalArgs:
        current_team = self.context.dao_state().teamAddress
        new_team = random.choice(
            [
                team
                for team in self.context.team_candidates
                if team.pubkey != current_team
            ]
        )
        action = random.choice(
            (
                SpendingLimitAction.Keep(),
                SpendingLimitAction.Remove(),
                SpendingLimitAction.Set(
                    valid_spending_limit(self.context.member_candidates)
                ),
            )
        )
        return InitializeHostileTakeoverProposalArgs(
            newTeamAddress=new_team.pubkey,
            spendingLimitAction=action,
        )

    def payload(self, args, accounts) -> tuple[Instruction, ...]:
        context = self.context
        update = FutarchyProgram.updateDao(
            UpdateDaoParams(
                passThresholdBps=None,
                secondsPerProposal=None,
                twapInitialObservation=None,
                twapMaxObservationChangePerUpdate=None,
                twapStartDelaySeconds=None,
                minQuoteFutarchicLiquidity=None,
                minBaseFutarchicLiquidity=None,
                baseToStake=None,
                teamSponsoredPassThresholdBps=None,
                teamAddress=args.newTeamAddress,
            ),
            dao=context.dao,
            squadsMultisigVault=context.council,
            eventAuthority=context.event_authority,
            program=context.program_id,
        )
        instructions = [update]
        config = None
        if isinstance(args.spendingLimitAction, SpendingLimitAction.Remove):
            config = SetSpendingLimitArgs(config=None)
        elif isinstance(args.spendingLimitAction, SpendingLimitAction.Set):
            config = SetSpendingLimitArgs(config=args.spendingLimitAction._0)
        if config is not None:
            instructions.append(
                FutarchyProgram.setSpendingLimit(
                    config,
                    dao=context.dao,
                    squadsMultisigVault=context.council,
                    eventAuthority=context.event_authority,
                    program=context.program_id,
                )
            )
        return tuple(instructions)

    def build_instruction(self, args, accounts, **overrides):
        return FutarchyProgram.initializeHostileTakeoverProposal(
            args, **self.common_accounts(accounts)
        )

    def assert_action(self, action, args) -> None:
        assert isinstance(action, ProposalAction.HostileTakeover)
        assert action.newTeamAddress == args.newTeamAddress
        assert action.spendingLimitAction == args.spendingLimitAction

    def unhappy_case(self):
        if random.choice((False, True)):
            args = self.happy_args()
            args.newTeamAddress = self.context.dao_state().teamAddress
            return args, FutarchyProgram.InvalidTeamAddress, 2, {}
        invalid, error_name = invalid_spending_limit(
            self.context.member_candidates
        )
        current_team = self.context.dao_state().teamAddress
        new_team = random.choice(
            [
                team
                for team in self.context.team_candidates
                if team.pubkey != current_team
            ]
        )
        args = InitializeHostileTakeoverProposalArgs(
            newTeamAddress=new_team.pubkey,
            spendingLimitAction=SpendingLimitAction.Set(invalid),
        )
        return args, getattr(FutarchyProgram, error_name), 2, {}
