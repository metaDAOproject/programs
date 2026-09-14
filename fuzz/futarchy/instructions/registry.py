"""Construct one concise wrapper registry for every in-scope instruction."""

from __future__ import annotations

from typing import Any

from .admin_cancel_proposal import AdminCancelProposalInstruction
from .admin_enqueue_multisig_proposal_cancellation import (
    AdminEnqueueMultisigProposalCancellationInstruction,
)
from .admin_enqueue_multisig_proposal_approval import (
    AdminEnqueueMultisigProposalApprovalInstruction,
)
from .admin_execute_multisig_proposal import AdminExecuteMultisigProposalInstruction
from .admin_remove_proposal import AdminRemoveProposalInstruction
from .admin_update_proposal_params import AdminUpdateProposalParamsInstruction
from .base import InstructionWrapper
from .collect_fees import CollectFeesInstruction
from .conditional_swap import ConditionalSwapInstruction
from .execute_multisig_proposal_approval import (
    ExecuteMultisigProposalApprovalInstruction,
)
from .execute_multisig_proposal_cancellation import (
    ExecuteMultisigProposalCancellationInstruction,
)
from .execute_passed_payload import ExecutePassedPayloadInstruction
from .finalize_proposal import FinalizeProposalInstruction
from .initialize_buyback_token_proposal import (
    InitializeBuybackTokenProposalInstruction,
)
from .initialize_dao import InitializeDaoInstruction
from .initialize_hostile_liquidate_proposal import (
    InitializeHostileLiquidateProposalInstruction,
)
from .initialize_hostile_takeover_proposal import (
    InitializeHostileTakeoverProposalInstruction,
)
from .initialize_large_spend_proposal import InitializeLargeSpendProposalInstruction
from .initialize_mint_tokens_proposal import InitializeMintTokensProposalInstruction
from .initialize_proposal import InitializeProposalInstruction
from .initialize_spending_limit_change_proposal import (
    InitializeSpendingLimitChangeProposalInstruction,
)
from .launch_proposal import LaunchProposalInstruction
from .provide_liquidity import ProvideLiquidityInstruction
from .set_spending_limit import SetSpendingLimitInstruction
from .sponsor_proposal import SponsorProposalInstruction
from .spot_swap import SpotSwapInstruction
from .stake_to_proposal import StakeToProposalInstruction
from .sync_spending_limit import SyncSpendingLimitInstruction
from .unstake_from_proposal import UnstakeFromProposalInstruction
from .update_dao import UpdateDaoInstruction
from .withdraw_liquidity import WithdrawLiquidityInstruction


class FutarchyInstructions:
    """Expose wrappers under names matching the Rust public API."""

    def __init__(self, context: Any) -> None:
        self.initialize_dao = InitializeDaoInstruction(context)
        self.initialize_proposal = InitializeProposalInstruction(context)
        self.initialize_large_spend_proposal = (
            InitializeLargeSpendProposalInstruction(context)
        )
        self.initialize_mint_tokens_proposal = (
            InitializeMintTokensProposalInstruction(context)
        )
        self.initialize_spending_limit_change_proposal = (
            InitializeSpendingLimitChangeProposalInstruction(context)
        )
        self.initialize_hostile_takeover_proposal = (
            InitializeHostileTakeoverProposalInstruction(context)
        )
        self.initialize_hostile_liquidate_proposal = (
            InitializeHostileLiquidateProposalInstruction(context)
        )
        self.initialize_buyback_token_proposal = (
            InitializeBuybackTokenProposalInstruction(context)
        )
        self.stake_to_proposal = StakeToProposalInstruction(context)
        self.unstake_from_proposal = UnstakeFromProposalInstruction(context)
        self.launch_proposal = LaunchProposalInstruction(context)
        self.finalize_proposal = FinalizeProposalInstruction(context)
        self.update_dao = UpdateDaoInstruction(context)
        self.set_spending_limit = SetSpendingLimitInstruction(context)
        self.sync_spending_limit = SyncSpendingLimitInstruction(context)
        self.spot_swap = SpotSwapInstruction(context)
        self.conditional_swap = ConditionalSwapInstruction(context)
        self.provide_liquidity = ProvideLiquidityInstruction(context)
        self.withdraw_liquidity = WithdrawLiquidityInstruction(context)
        self.collect_fees = CollectFeesInstruction(context)
        self.sponsor_proposal = SponsorProposalInstruction(context)
        self.admin_enqueue_multisig_proposal_approval = (
            AdminEnqueueMultisigProposalApprovalInstruction(context)
        )
        self.execute_multisig_proposal_approval = (
            ExecuteMultisigProposalApprovalInstruction(context)
        )
        self.admin_enqueue_multisig_proposal_cancellation = (
            AdminEnqueueMultisigProposalCancellationInstruction(context)
        )
        self.execute_multisig_proposal_cancellation = (
            ExecuteMultisigProposalCancellationInstruction(context)
        )
        self.admin_execute_multisig_proposal = (
            AdminExecuteMultisigProposalInstruction(context)
        )
        self.admin_cancel_proposal = AdminCancelProposalInstruction(context)
        self.admin_remove_proposal = AdminRemoveProposalInstruction(context)
        self.admin_update_proposal_params = (
            AdminUpdateProposalParamsInstruction(context)
        )
        self.execute_passed_payload = ExecutePassedPayloadInstruction(context)

    @staticmethod
    def compute_limit():
        """Expose the shared compute-budget instruction to setup utilities."""
        return InstructionWrapper.compute_unit_limit()
