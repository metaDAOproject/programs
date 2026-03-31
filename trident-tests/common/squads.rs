use squads_multisig::client::ProposalCreateAccounts;
use squads_multisig::client::ProposalCreateArgs;
use squads_multisig::client::VaultTransactionCreateAccounts;
use squads_multisig::state::TransactionMessage;
use trident_fuzz::fuzzing::*;

/// Standalone Squads helper functions that work with Trident directly
#[allow(clippy::too_many_arguments)]
pub fn initialize_vault_transaction(
    trident: &mut Trident,
    multisig: Pubkey,
    squads_tx_creator: Pubkey,
    payer: Pubkey,
    vault_index: u8,
    num_ephemeral_signers: u8,
    transaction_message: TransactionMessage,
    message: Option<&str>,
) {
    let transaction = squads_multisig::pda::get_transaction_pda(&multisig, 1, None).0;
    let vault_tx_create = squads_multisig::client::vault_transaction_create(
        VaultTransactionCreateAccounts {
            multisig,
            transaction,
            creator: squads_tx_creator,
            rent_payer: payer,
            system_program: solana_sdk::system_program::ID,
        },
        vault_index,
        num_ephemeral_signers,
        &transaction_message,
        None,
        None,
    );

    let res = trident.process_transaction(&[vault_tx_create], message);

    invariant!(res.is_success());
}

pub fn initialize_squads_proposal(
    trident: &mut Trident,
    multisig: Pubkey,
    squads_proposal_creator: Pubkey,
    payer: Pubkey,
    proposal_create_args: ProposalCreateArgs,
    message: Option<&str>,
) -> Pubkey {
    let squads_proposal = squads_multisig::pda::get_proposal_pda(
        &multisig,
        proposal_create_args.transaction_index,
        None,
    )
    .0;

    let create_proposal = squads_multisig::client::proposal_create(
        ProposalCreateAccounts {
            multisig,
            proposal: squads_proposal,
            creator: squads_proposal_creator,
            rent_payer: payer,
            system_program: solana_sdk::system_program::ID,
        },
        proposal_create_args,
        None,
    );

    let res = trident.process_transaction(&[create_proposal], message);

    invariant!(res.is_success());

    squads_proposal
}
