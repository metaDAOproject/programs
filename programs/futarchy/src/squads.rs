use anchor_lang::prelude::*;
use anchor_lang::solana_program::address_lookup_table::{self, state::AddressLookupTable};

use std::collections::BTreeMap;

use crate::FutarchyError;

/// Validates that every address lookup table a vault transaction message
/// references is frozen (`authority` permanently `None`, so its contents can
/// never change) and already holds every index the message references.
/// `lookup_table_accounts` must hold exactly one account per
/// `message.address_table_lookups` entry, in the same order, which is the
/// convention Squads' own `vault_transaction_execute` uses.
pub fn validate_address_lookup_tables<'info>(
    message: &squads_multisig_program::VaultTransactionMessage,
    lookup_table_accounts: &[AccountInfo<'info>],
) -> Result<()> {
    require_eq!(
        lookup_table_accounts.len(),
        message.address_table_lookups.len(),
        FutarchyError::InvalidAddressLookupTable
    );

    for (lookup, lookup_table_account) in message
        .address_table_lookups
        .iter()
        .zip(lookup_table_accounts.iter())
    {
        require_keys_eq!(
            *lookup_table_account.key,
            lookup.account_key,
            FutarchyError::InvalidAddressLookupTable
        );
        require_keys_eq!(
            *lookup_table_account.owner,
            address_lookup_table::program::ID,
            FutarchyError::InvalidAddressLookupTable
        );

        let lookup_table_data = lookup_table_account.try_borrow_data()?;
        let lookup_table = AddressLookupTable::deserialize(&lookup_table_data)
            .map_err(|_| FutarchyError::InvalidAddressLookupTable)?;

        require!(
            lookup_table.meta.authority.is_none(),
            FutarchyError::UnfrozenAddressLookupTable
        );

        // A frozen table's length is final, so an index past it could never
        // be filled and the proposal could pass its market yet never execute.
        if let Some(max_index) = lookup
            .writable_indexes
            .iter()
            .chain(lookup.readonly_indexes.iter())
            .max()
        {
            require_gt!(
                lookup_table.addresses.len(),
                usize::from(*max_index),
                FutarchyError::InvalidAddressLookupTable
            );
        }
    }

    Ok(())
}

/// Compiles a Solana instruction into a Squads TransactionMessage format.
/// This is necessary because Solana's Message::serialize() uses a different header format
/// (num_readonly_signed_accounts, num_readonly_unsigned_accounts) than Squads expects
/// (num_writable_signers, num_writable_non_signers).
pub fn compile_squads_transaction_message(
    vault_key: &Pubkey,
    instructions: &[anchor_lang::solana_program::instruction::Instruction],
) -> Result<squads_multisig_program::TransactionMessage> {
    // Track account metadata: (is_signer, is_writable)
    let mut key_meta_map: BTreeMap<Pubkey, (bool, bool)> = BTreeMap::new();

    // Add vault as a signer (it will sign the vault transaction)
    // Writability is determined by whether it appears as writable in instruction accounts
    key_meta_map.insert(*vault_key, (true, false));

    // Collect all accounts from instructions, merging their flags with OR
    for ix in instructions {
        // Program ID is a non-signer, non-writable account
        key_meta_map.entry(ix.program_id).or_insert((false, false));

        for meta in &ix.accounts {
            let entry = key_meta_map.entry(meta.pubkey).or_insert((false, false));
            entry.0 |= meta.is_signer;
            entry.1 |= meta.is_writable;
        }
    }

    // Sort accounts into: writable signers, readonly signers, writable non-signers, readonly non-signers
    let mut writable_signers: Vec<Pubkey> = Vec::new();
    let mut readonly_signers: Vec<Pubkey> = Vec::new();
    let mut writable_non_signers: Vec<Pubkey> = Vec::new();
    let mut readonly_non_signers: Vec<Pubkey> = Vec::new();

    for (pubkey, (is_signer, is_writable)) in &key_meta_map {
        if *is_signer && *is_writable {
            writable_signers.push(*pubkey);
        } else if *is_signer {
            // Vault key should be first among readonly signers
            if *pubkey == *vault_key {
                readonly_signers.insert(0, *pubkey);
            } else {
                readonly_signers.push(*pubkey);
            }
        } else if *is_writable {
            writable_non_signers.push(*pubkey);
        } else {
            readonly_non_signers.push(*pubkey);
        }
    }

    // Build the final account keys list in sorted order
    let mut account_keys: Vec<Pubkey> = Vec::new();
    account_keys.extend(&writable_signers);
    account_keys.extend(&readonly_signers);
    account_keys.extend(&writable_non_signers);
    account_keys.extend(&readonly_non_signers);

    // Calculate counts
    let num_signers = (writable_signers.len() + readonly_signers.len()) as u8;
    let num_writable_signers = writable_signers.len() as u8;
    let num_writable_non_signers = writable_non_signers.len() as u8;

    // Build account key index lookup
    let key_to_index: BTreeMap<Pubkey, u8> = account_keys
        .iter()
        .enumerate()
        .map(|(i, k)| (*k, i as u8))
        .collect();

    // Compile instructions with new indices
    let mut compiled_instructions: Vec<squads_multisig_program::CompiledInstruction> = Vec::new();
    for ix in instructions {
        let program_id_index = *key_to_index
            .get(&ix.program_id)
            .ok_or(FutarchyError::InvalidTransactionMessage)?;

        let account_indexes: Vec<u8> = ix
            .accounts
            .iter()
            .map(|meta| key_to_index.get(&meta.pubkey).copied())
            .collect::<Option<Vec<u8>>>()
            .ok_or(FutarchyError::InvalidTransactionMessage)?;

        compiled_instructions.push(squads_multisig_program::CompiledInstruction {
            program_id_index,
            account_indexes: squads_multisig_program::SmallVec::from(account_indexes),
            data: squads_multisig_program::SmallVec::from(ix.data.clone()),
        });
    }

    Ok(squads_multisig_program::TransactionMessage {
        num_signers,
        num_writable_signers,
        num_writable_non_signers,
        account_keys: squads_multisig_program::SmallVec::from(account_keys),
        instructions: squads_multisig_program::SmallVec::from(compiled_instructions),
        address_table_lookups: squads_multisig_program::SmallVec::from(Vec::<
            squads_multisig_program::MessageAddressTableLookup,
        >::new()),
    })
}
