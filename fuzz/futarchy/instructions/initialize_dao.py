"""Snapshot-checked wrapper for Futarchy ``initialize_dao``."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from wake_sol import Account, random, svm

from .base import InstructionWrapper
from ..constants import FUTARCHY_PROGRAM_ID, SQUADS_PROGRAM_ID
from ..pytypes.futarchy import (
    Dao,
    Futarchy as FutarchyProgram,
    InitialSpendingLimit,
    InitializeDaoParams,
    PoolState,
)
from ..utils.accounts import (
    derive_dao,
    derive_squads_multisig,
    derive_squads_spending_limit,
    derive_squads_vault,
)
from ..utils.parameters import (
    invalid_spending_limit,
    production_dao_config,
    valid_dao_config,
    valid_spending_limit,
)


@dataclass(slots=True)
class DaoInitializationAccounts:
    """All addresses whose seeds depend on one DAO creator and nonce."""

    creator: Account
    nonce: int
    dao: Account
    squads_multisig: Account
    council: Account
    spending_limit: Account
    amm_base_vault: Account
    amm_quote_vault: Account


class InitializeDaoInstruction(InstructionWrapper):
    """Build parameters/accounts and verify real DAO/Squads initialization."""

    @staticmethod
    def build_params(
        config: dict[str, int],
        *,
        nonce: int,
        spending_limit: InitialSpendingLimit | None,
        team: Account,
    ) -> InitializeDaoParams:
        """Build generated parameters from named protocol configuration."""
        return InitializeDaoParams(
            twapInitialObservation=config["twap_initial_observation"],
            twapMaxObservationChangePerUpdate=config[
                "twap_max_observation_change_per_update"
            ],
            twapStartDelaySeconds=config["twap_start_delay_seconds"],
            minQuoteFutarchicLiquidity=config[
                "min_quote_futarchic_liquidity"
            ],
            minBaseFutarchicLiquidity=config[
                "min_base_futarchic_liquidity"
            ],
            baseToStake=config["base_to_stake"],
            passThresholdBps=config["pass_threshold_bps"],
            secondsPerProposal=config["seconds_per_proposal"],
            nonce=nonce,
            initialSpendingLimit=spending_limit,
            teamSponsoredPassThresholdBps=config[
                "team_sponsored_pass_threshold_bps"
            ],
            teamAddress=team.pubkey,
        )

    def derive_accounts(
        self, creator: Account, nonce: int, base_mint: Account, quote_mint: Account
    ) -> DaoInitializationAccounts:
        """Derive every Futarchy and Squads address for an initialization."""
        context = self.context
        dao, _ = derive_dao(creator, nonce, FUTARCHY_PROGRAM_ID)
        multisig, _ = derive_squads_multisig(dao, SQUADS_PROGRAM_ID)
        council, _ = derive_squads_vault(multisig, SQUADS_PROGRAM_ID)
        spending_limit, _ = derive_squads_spending_limit(
            multisig, dao, SQUADS_PROGRAM_ID
        )
        amm_base = Account(svm.token.ata_address(dao, base_mint))
        amm_quote = Account(svm.token.ata_address(dao, quote_mint))
        return DaoInitializationAccounts(
            creator=creator,
            nonce=nonce,
            dao=dao,
            squads_multisig=multisig,
            council=council,
            spending_limit=spending_limit,
            amm_base_vault=amm_base,
            amm_quote_vault=amm_quote,
        )

    def build_instruction(
        self,
        params: InitializeDaoParams,
        accounts: DaoInitializationAccounts,
        *,
        base_mint: Account | None = None,
        quote_mint: Account | None = None,
    ) -> Any:
        """Wire the DAO plus every nested Squads CPI account."""
        context = self.context
        return FutarchyProgram.initializeDao(
            params,
            dao=accounts.dao,
            daoCreator=accounts.creator,
            payer=context.payer,
            baseMint=base_mint or context.base_mint,
            quoteMint=quote_mint or context.quote_mint,
            squadsMultisig=accounts.squads_multisig,
            squadsMultisigVault=accounts.council,
            squadsProgram=SQUADS_PROGRAM_ID,
            squadsProgramConfig=context.squads_program_config,
            squadsProgramConfigTreasury=context.squads_program_config_treasury,
            spendingLimit=accounts.spending_limit,
            futarchyAmmBaseVault=accounts.amm_base_vault,
            futarchyAmmQuoteVault=accounts.amm_quote_vault,
            eventAuthority=context.event_authority,
            program=FUTARCHY_PROGRAM_ID,
        )

    def assert_initialized(
        self,
        accounts: DaoInitializationAccounts,
        params: InitializeDaoParams,
        base_mint: Account,
        quote_mint: Account,
    ) -> None:
        """Check the initialized account graph and every parameter snapshot."""
        dao = Dao.decode(accounts.dao.data)
        assert dao.nonce == params.nonce
        assert dao.daoCreator == accounts.creator.pubkey
        assert dao.squadsMultisig == accounts.squads_multisig.pubkey
        assert dao.squadsMultisigVault == accounts.council.pubkey
        assert dao.baseMint == base_mint.pubkey
        assert dao.quoteMint == quote_mint.pubkey
        assert dao.seqNum == 1
        assert dao.proposalCount == 0
        assert dao.passThresholdBps == params.passThresholdBps
        assert dao.secondsPerProposal == params.secondsPerProposal
        assert dao.twapInitialObservation == params.twapInitialObservation
        assert (
            dao.twapMaxObservationChangePerUpdate
            == params.twapMaxObservationChangePerUpdate
        )
        assert dao.twapStartDelaySeconds == params.twapStartDelaySeconds
        assert (
            dao.minQuoteFutarchicLiquidity
            == params.minQuoteFutarchicLiquidity
        )
        assert (
            dao.minBaseFutarchicLiquidity
            == params.minBaseFutarchicLiquidity
        )
        assert dao.baseToStake == params.baseToStake
        assert dao.initialSpendingLimit == params.initialSpendingLimit
        assert (
            dao.teamSponsoredPassThresholdBps
            == params.teamSponsoredPassThresholdBps
        )
        assert dao.teamAddress == params.teamAddress
        assert isinstance(dao.amm.state, PoolState.Spot)
        assert dao.amm.totalLiquidity == 0
        assert dao.amm.baseMint == base_mint.pubkey
        assert dao.amm.quoteMint == quote_mint.pubkey
        assert dao.amm.state.spot.baseReserves == 0
        assert dao.amm.state.spot.quoteReserves == 0
        assert (
            dao.amm.state.spot.oracle.initialObservation
            == params.twapInitialObservation
        )
        assert (
            dao.amm.state.spot.oracle.maxObservationChangePerUpdate
            == params.twapMaxObservationChangePerUpdate
        )
        assert dao.amm.state.spot.oracle.startDelaySeconds == 0
        assert accounts.squads_multisig.owner == SQUADS_PROGRAM_ID
        assert accounts.spending_limit.exists == (
            params.initialSpendingLimit is not None
        )
        if accounts.spending_limit.exists:
            assert accounts.spending_limit.owner == SQUADS_PROGRAM_ID
        self.context.squads.assert_spending_limit(
            params.initialSpendingLimit,
            account=accounts.spending_limit,
            multisig=accounts.squads_multisig,
            dao=accounts.dao,
            quote_mint=quote_mint,
        )
        assert accounts.amm_base_vault.owner == svm.token.program_id
        assert accounts.amm_quote_vault.owner == svm.token.program_id

    def initialize_main(self) -> None:
        """Initialize the sequence's primary DAO at the production baseline."""
        context = self.context
        accounts = DaoInitializationAccounts(
            creator=context.dao_creator,
            nonce=context.dao_nonce,
            dao=context.dao,
            squads_multisig=context.squads_multisig,
            council=context.council,
            spending_limit=context.squads_spending_limit,
            amm_base_vault=context.amm_base_vault,
            amm_quote_vault=context.amm_quote_vault,
        )
        spending_limit = InitialSpendingLimit(
            amountPerMonth=context.initial_spending_limit_amount,
            members=[context.payer.pubkey],
        )
        params = self.build_params(
            production_dao_config(),
            nonce=context.dao_nonce,
            spending_limit=spending_limit,
            team=context.team_address,
        )
        instruction = self.build_instruction(params, accounts)
        context.payer.tx(
            self.compute_unit_limit(),
            instruction,
            signers=[context.dao_creator],
        )
        self.assert_initialized(
            accounts, params, context.base_mint, context.quote_mint
        )

    def can_happy(self) -> bool:
        """Auxiliary DAOs remain meaningful only before terminal liquidation."""
        return not self.context.is_liquidated()

    def happy(self) -> None:
        """Initialize a fresh auxiliary DAO and verify all created accounts."""
        context = self.context
        creator = Account.new()
        creator.label = "auxiliary DAO creator"
        svm.airdrop(creator, context.actor_lamports)
        context.next_aux_nonce += 1
        accounts = self.derive_accounts(
            creator,
            context.next_aux_nonce,
            context.base_mint,
            context.quote_mint,
        )
        config = valid_dao_config()
        limit = (
            valid_spending_limit(context.member_candidates)
            if random.choice((False, True))
            else None
        )
        params = self.build_params(
            config,
            nonce=accounts.nonce,
            spending_limit=limit,
            team=random.choice(context.team_candidates),
        )
        instruction = self.build_instruction(params, accounts)
        before = self.snapshot(instruction)
        context.payer.tx(
            self.compute_unit_limit(), instruction, signers=[creator]
        )
        assert not before.account(accounts.dao).exists
        self.assert_initialized(
            accounts, params, context.base_mint, context.quote_mint
        )
        context.auxiliary_daos.append(accounts)
        context.register_token_account(context.base_mint, accounts.amm_base_vault)
        context.register_token_account(context.quote_mint, accounts.amm_quote_vault)

    def can_unhappy(self) -> bool:
        """The invalid-mint case is independent of proposal state."""
        return not self.context.is_liquidated()

    def unhappy(self) -> None:
        """Reject an invalid mint or spending limit with full CPI rollback."""
        context = self.context
        creator = Account.new()
        creator.label = "invalid DAO creator"
        svm.airdrop(creator, context.actor_lamports)
        context.next_aux_nonce += 1
        invalid_mint = random.choice((False, True))
        base_mint = context.quote_mint if invalid_mint else context.base_mint
        accounts = self.derive_accounts(
            creator, context.next_aux_nonce, base_mint, context.quote_mint
        )
        spending_limit = None
        expected = FutarchyProgram.InvalidMint
        if not invalid_mint:
            spending_limit, error_name = invalid_spending_limit(
                context.member_candidates
            )
            expected = getattr(FutarchyProgram, error_name)
        params = self.build_params(
            production_dao_config(),
            nonce=accounts.nonce,
            spending_limit=spending_limit,
            team=context.team_address,
        )
        instruction = self.build_instruction(
            params,
            accounts,
            base_mint=base_mint,
            quote_mint=context.quote_mint,
        )
        self.assert_fails_atomically(
            context.payer,
            instruction,
            expected,
            before=(self.compute_unit_limit(),),
            signers=(creator,),
        )
