"""Short dependency-ordered setup phases for each Futarchy fuzz sequence."""

from __future__ import annotations

from typing import Any

from wake_sol import Account, svm

from ..constants import (
    ACTOR_COUNT,
    ACTOR_LAMPORTS,
    BASE_SLOT,
    BASE_TIMESTAMP,
    CONDITIONAL_VAULT_PROGRAM_ID,
    CONDITIONAL_VAULT_SO,
    FUTARCHY_PROGRAM_ID,
    FUTARCHY_SO,
    INITIAL_ACTOR_BASE_BALANCE,
    INITIAL_ACTOR_QUOTE_BALANCE,
    METADAO_MULTISIG_VAULT,
    PAYER_LAMPORTS,
    PERMISSIONLESS_ACCOUNT_SECRET,
    SQUADS_PROGRAM_CONFIG,
    SQUADS_PROGRAM_CONFIG_DATA,
    SQUADS_PROGRAM_CONFIG_TREASURY,
    SQUADS_PROGRAM_ID,
    SQUADS_PERMISSIONLESS_MEMBER,
    SQUADS_SO,
    V08_DAO_NONCE,
    V08_MONTHLY_SPENDING_LIMIT,
)
from .accounts import (
    derive_dao,
    derive_event_authority,
    derive_squads_multisig,
    derive_squads_spending_limit,
    derive_squads_vault,
)
from .tokens import create_ata, create_mint, mint_to, set_mint_authority


class FutarchySequenceSetup:
    """Populate only real programs, signers, token accounts, and normal state."""

    def __init__(self, context: Any) -> None:
        self.context = context

    def install_programs_and_clock(self) -> None:
        """Install Futarchy dependencies and deterministic Squads genesis state."""
        svm.add_program(FUTARCHY_PROGRAM_ID, FUTARCHY_SO.read_bytes())
        svm.add_program(
            CONDITIONAL_VAULT_PROGRAM_ID,
            CONDITIONAL_VAULT_SO.read_bytes(),
        )
        svm.add_program(SQUADS_PROGRAM_ID, SQUADS_SO.read_bytes())
        config = SQUADS_PROGRAM_CONFIG_DATA.read_bytes()
        svm.set_account(
            SQUADS_PROGRAM_CONFIG,
            lamports=svm.minimum_balance_for_rent_exemption(len(config)),
            data=config,
            owner=SQUADS_PROGRAM_ID,
        )
        svm.airdrop(SQUADS_PROGRAM_CONFIG_TREASURY, ACTOR_LAMPORTS)
        svm.set_clock(unix_timestamp=BASE_TIMESTAMP, slot=BASE_SLOT)

    def create_signers_and_addresses(self) -> None:
        """Create funded identities and derive the primary DAO/Squads graph."""
        context = self.context
        context.actor_lamports = ACTOR_LAMPORTS
        context.program_id = FUTARCHY_PROGRAM_ID
        context.squads_program_id = SQUADS_PROGRAM_ID
        context.payer = Account.new()
        context.payer.label = "transaction / rent payer"
        svm.airdrop(context.payer, PAYER_LAMPORTS)
        context.ops_admin = Account.new()
        context.ops_admin.label = "development ops admin (enqueue / proposal params)"
        context.proposal_admin = Account.new()
        context.proposal_admin.label = "development proposal admin (cancel / remove / execute)"
        context.fee_admin = Account.new()
        context.fee_admin.label = "development fee collector"
        admins = (context.ops_admin, context.proposal_admin, context.fee_admin)
        context.dao_creator = Account.new()
        context.dao_creator.label = "primary DAO creator"
        context.team_candidates = [Account.new(), Account.new()]
        context.team_candidates[0].label = "team A"
        context.team_candidates[1].label = "team B"
        context.team_address = context.team_candidates[0]
        context.outsider = Account.new()
        context.outsider.label = "outsider / liquidator"
        context.actors = [Account.new() for _ in range(ACTOR_COUNT)]
        for index, actor in enumerate(context.actors):
            actor.label = f"actor {index}"
        extras = [Account.new() for _ in range(8)]
        for index, account in enumerate(extras):
            account.label = f"member candidate {index}"
        context.member_candidates = [
            *context.actors,
            *context.team_candidates,
            context.outsider,
            *extras,
        ]
        context.liquidator_candidates = [context.outsider, *context.actors]
        funded = {
            account.pubkey: account
            for account in (
                context.dao_creator,
                *admins,
                *context.member_candidates,
            )
        }
        for account in funded.values():
            svm.airdrop(account, ACTOR_LAMPORTS)

        context.permissionless_account = Account.from_secret(
            PERMISSIONLESS_ACCOUNT_SECRET
        )
        context.permissionless_account.label = "Squads permissionless member"
        assert context.permissionless_account.pubkey == SQUADS_PERMISSIONLESS_MEMBER
        svm.airdrop(context.permissionless_account, ACTOR_LAMPORTS)
        context.signers_by_pubkey = {
            account.pubkey: account
            for account in (
                context.payer,
                context.dao_creator,
                context.permissionless_account,
                *admins,
                *context.member_candidates,
            )
        }
        context.proposal_proposer = context.actors[0]

        context.dao_nonce = V08_DAO_NONCE
        context.dao, _ = derive_dao(
            context.dao_creator, context.dao_nonce, FUTARCHY_PROGRAM_ID
        )
        context.dao.label = "primary Futarchy DAO"
        context.squads_multisig, _ = derive_squads_multisig(
            context.dao, SQUADS_PROGRAM_ID
        )
        context.squads_multisig.label = "DAO Squads multisig"
        context.council, _ = derive_squads_vault(
            context.squads_multisig, SQUADS_PROGRAM_ID
        )
        context.council.label = "DAO Squads vault"
        context.squads_spending_limit, _ = derive_squads_spending_limit(
            context.squads_multisig, context.dao, SQUADS_PROGRAM_ID
        )
        context.squads_spending_limit.label = "DAO Squads spending limit"
        context.squads_program_config = Account(SQUADS_PROGRAM_CONFIG)
        context.squads_program_config_treasury = Account(
            SQUADS_PROGRAM_CONFIG_TREASURY
        )
        context.event_authority, _ = derive_event_authority(FUTARCHY_PROGRAM_ID)
        context.vault_event_authority, _ = derive_event_authority(
            CONDITIONAL_VAULT_PROGRAM_ID
        )

    def create_tokens_and_bookkeeping(self) -> None:
        """Create realistic token ledgers and reset lightweight resource registries."""
        context = self.context
        context.base_token_accounts = {}
        context.quote_token_accounts = {}
        context.proposals = []
        context.squads_transactions = []
        context.position_accounts = {}
        context.stake_accounts = {}
        context.auxiliary_daos = []
        context.squads_transaction_index = 0
        context.typed_market_nonce = 0
        context.next_aux_nonce = 10_000
        context.initial_spending_limit_amount = V08_MONTHLY_SPENDING_LIMIT

        context.base_mint = Account.new()
        context.base_mint.label = "base mint"
        context.quote_mint = Account.new()
        context.quote_mint.label = "quote mint"
        create_mint(context.payer, context.base_mint, context.payer)
        create_mint(context.payer, context.quote_mint, context.payer)
        context.base_atas_by_owner = {}
        context.quote_atas_by_owner = {}
        for actor in context.actors:
            base = create_ata(context.payer, actor, context.base_mint)
            quote = create_ata(context.payer, actor, context.quote_mint)
            base.label = f"{actor.label} base ATA"
            quote.label = f"{actor.label} quote ATA"
            context.base_atas_by_owner[actor.pubkey] = base
            context.quote_atas_by_owner[actor.pubkey] = quote
            context.register_token_account(context.base_mint, base)
            context.register_token_account(context.quote_mint, quote)
            mint_to(
                context.payer,
                context.base_mint,
                base,
                context.payer,
                INITIAL_ACTOR_BASE_BALANCE,
            )
            mint_to(
                context.payer,
                context.quote_mint,
                quote,
                context.payer,
                INITIAL_ACTOR_QUOTE_BALANCE,
            )

        context.amm_base_vault = Account(
            svm.token.ata_address(context.dao, context.base_mint)
        )
        context.amm_base_vault.label = "DAO spot base vault"
        context.amm_quote_vault = Account(
            svm.token.ata_address(context.dao, context.quote_mint)
        )
        context.amm_quote_vault.label = "DAO spot quote vault"
        context.fee_base_account = context.ensure_underlying_ata(
            METADAO_MULTISIG_VAULT, context.base_mint
        )
        context.fee_quote_account = context.ensure_underlying_ata(
            METADAO_MULTISIG_VAULT, context.quote_mint
        )
        context.council_base_account = context.ensure_underlying_ata(
            context.council, context.base_mint
        )
        context.council_quote_account = context.ensure_underlying_ata(
            context.council, context.quote_mint
        )
        for team in context.team_candidates:
            context.ensure_underlying_ata(team, context.base_mint)
            context.ensure_underlying_ata(team, context.quote_mint)
        mint_to(
            context.payer,
            context.quote_mint,
            context.council_quote_account,
            context.payer,
            500_000_000_000,
        )
        set_mint_authority(
            context.payer,
            context.base_mint,
            context.payer,
            context.council,
        )

    def initialize_normal_state(self) -> None:
        """Use public instructions for the primary DAO and one baseline Draft."""
        context = self.context
        context.instructions.initialize_dao.initialize_main()
        context.register_token_account(context.base_mint, context.amm_base_vault)
        context.register_token_account(context.quote_mint, context.amm_quote_vault)
        context.instructions.initialize_proposal.create_baseline()
