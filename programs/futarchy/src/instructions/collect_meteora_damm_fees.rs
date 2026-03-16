use anchor_lang::AnchorSerialize;
use anchor_lang::InstructionData;
use damm_v2_cpi::program::DammV2Cpi;
use std::collections::BTreeMap;

use super::*;

pub mod metadao_multisig_vault {
    use anchor_lang::prelude::declare_id;

    // MetaDAO multisig
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

pub mod metadao_admin {
    use anchor_lang::prelude::declare_id;

    // We must use a non-Squads signer because of CPI depth limits
    declare_id!("tSTp6B6kE9o6ZaTmHm2ZwnJBBtgd3x112tapxFhmBEQ");
}

pub mod pool_authority {
    use anchor_lang::prelude::declare_id;

    // DAMM V2 Pool Authority
    declare_id!("HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC");
}

#[derive(Accounts)]
#[event_cpi]
pub struct CollectMeteoraDammFees<'info> {
    #[account(
        mut,
        constraint = dao.base_mint == meteora_claim_position_fees_accounts.token_a_mint.key(),
        constraint = dao.quote_mint == meteora_claim_position_fees_accounts.token_b_mint.key()
    )]
    pub dao: Account<'info, Dao>,
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: checked by futarchy program
    #[account(mut, seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig_program::SEED_MULTISIG, dao.key().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig: Account<'info, squads_multisig_program::Multisig>,
    /// CHECK: signer for the squads transaction, checked by squads program
    #[account(mut, seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(), squads_multisig_program::SEED_VAULT, 0_u8.to_le_bytes().as_ref()], bump, seeds::program = squads_program)]
    pub squads_multisig_vault: UncheckedAccount<'info>,
    /// CHECK: squads transaction, initialized by squads multisig program, checked by squads multisig program
    #[account(mut)]
    pub squads_multisig_vault_transaction: UncheckedAccount<'info>,
    /// CHECK: squads proposal, initialized by squads multisig program, checked by squads multisig program
    #[account(mut)]
    pub squads_multisig_proposal: UncheckedAccount<'info>,

    #[account(address = permissionless_account::id())]
    pub squads_multisig_permissionless_account: Signer<'info>,

    pub meteora_claim_position_fees_accounts: MeteoraClaimPositionFeesAccounts<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub squads_program: Program<'info, squads_multisig_program::program::SquadsMultisigProgram>,
}

#[derive(Accounts)]
pub struct MeteoraClaimPositionFeesAccounts<'info> {
    pub damm_v2_program: Program<'info, DammV2Cpi>,

    /// CHECK: checked by damm v2 program
    pub damm_v2_event_authority: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(address = pool_authority::ID)]
    pub pool_authority: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    pub pool: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    #[account(mut)]
    pub position: UncheckedAccount<'info>,

    /// Token account of base tokens recipient
    #[account(mut, associated_token::mint = token_a_mint, associated_token::authority = metadao_multisig_vault::ID)]
    pub token_a_account: Account<'info, TokenAccount>,

    /// Token account of quote tokens recipient
    #[account(mut, associated_token::mint = token_b_mint, associated_token::authority = metadao_multisig_vault::ID)]
    pub token_b_account: Account<'info, TokenAccount>,

    /// CHECK: checked by damm v2 program, base token vault of the pool
    #[account(mut)]
    pub token_a_vault: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program, quote token vault of the pool
    #[account(mut)]
    pub token_b_vault: UncheckedAccount<'info>,

    /// CHECK: Checked from dao struct, base mint
    pub token_a_mint: UncheckedAccount<'info>,

    /// CHECK: Checked from dao struct, quote mint
    pub token_b_mint: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program
    pub position_nft_account: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program, owner of position - usually the DAO's squads multisig vault
    pub owner: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program, base token program
    pub token_a_program: UncheckedAccount<'info>,

    /// CHECK: checked by damm v2 program, quote token program
    pub token_b_program: UncheckedAccount<'info>,
}

impl CollectMeteoraDammFees<'_> {
    pub fn validate(&self) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(
            self.admin.key(),
            metadao_admin::ID,
            FutarchyError::InvalidAdmin
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let ix_data = damm_v2_cpi::instruction::ClaimPositionFee {}.data();

        // Record token balances before the fee claim
        let base_token_account_balance_before = ctx
            .accounts
            .meteora_claim_position_fees_accounts
            .token_a_account
            .amount;
        let quote_token_account_balance_before = ctx
            .accounts
            .meteora_claim_position_fees_accounts
            .token_b_account
            .amount;

        let account_infos = damm_v2_cpi::cpi::accounts::ClaimPositionFeeCtx {
            pool_authority: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .pool_authority
                .to_account_info(),
            pool: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .pool
                .to_account_info(),
            position: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .position
                .to_account_info(),
            token_a_account: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_a_account
                .to_account_info(),
            token_b_account: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_b_account
                .to_account_info(),
            token_a_vault: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_a_vault
                .to_account_info(),
            token_b_vault: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_b_vault
                .to_account_info(),
            token_a_mint: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_a_mint
                .to_account_info(),
            token_b_mint: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_b_mint
                .to_account_info(),
            position_nft_account: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .position_nft_account
                .to_account_info(),
            owner: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .owner
                .to_account_info(),
            token_a_program: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_a_program
                .to_account_info(),
            token_b_program: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_b_program
                .to_account_info(),
            event_authority: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .damm_v2_event_authority
                .to_account_info(),
            program: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .damm_v2_program
                .to_account_info(),
        };

        let accounts = account_infos.to_account_metas(None);

        let ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: damm_v2_cpi::ID,
            accounts,
            data: ix_data,
        };

        // Compile the transaction message in Squads' format
        // This correctly sets num_writable_signers and num_writable_non_signers
        // instead of the inverted readonly counts from Solana's Message::serialize()
        let transaction_message =
            compile_transaction_message(&ctx.accounts.squads_multisig_vault.key(), &[ix])?;

        let transaction_message_bytes = transaction_message.try_to_vec()?;

        let dao_nonce = &ctx.accounts.dao.nonce.to_le_bytes();
        let dao_creator_key = ctx.accounts.dao.dao_creator.as_ref();
        let dao_seeds = &[
            SEED_DAO,
            dao_creator_key,
            dao_nonce,
            &[ctx.accounts.dao.pda_bump],
        ];

        let dao_signer = &[&dao_seeds[..]];

        squads_multisig_program::cpi::vault_transaction_create(
            CpiContext::new(
                ctx.accounts.squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::VaultTransactionCreate {
                    creator: ctx
                        .accounts
                        .squads_multisig_permissionless_account
                        .to_account_info(),
                    multisig: ctx.accounts.squads_multisig.to_account_info(),
                    rent_payer: ctx.accounts.admin.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    transaction: ctx
                        .accounts
                        .squads_multisig_vault_transaction
                        .to_account_info(),
                },
            ),
            squads_multisig_program::VaultTransactionCreateArgs {
                ephemeral_signers: 0,
                vault_index: 0,
                transaction_message: transaction_message_bytes,
                memo: None,
            },
        )?;

        // Reload the squads multisig account to get the latest transaction index
        ctx.accounts.squads_multisig.reload()?;
        let transaction_index = ctx.accounts.squads_multisig.transaction_index;

        squads_multisig_program::cpi::proposal_create(
            CpiContext::new_with_signer(
                ctx.accounts.squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::ProposalCreate {
                    // DAO is the config authority - maybe this needs to be the permissionless account instead?
                    creator: ctx.accounts.dao.to_account_info(),
                    multisig: ctx.accounts.squads_multisig.to_account_info(),
                    rent_payer: ctx.accounts.admin.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    proposal: ctx.accounts.squads_multisig_proposal.to_account_info(),
                },
                dao_signer,
            ),
            squads_multisig_program::ProposalCreateArgs {
                transaction_index,
                draft: false,
            },
        )?;

        squads_multisig_program::cpi::proposal_approve(
            CpiContext::new_with_signer(
                ctx.accounts.squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::ProposalVote {
                    proposal: ctx.accounts.squads_multisig_proposal.to_account_info(),
                    multisig: ctx.accounts.squads_multisig.to_account_info(),
                    member: ctx.accounts.dao.to_account_info(), // DAO is the config authority
                },
                dao_signer,
            ),
            squads_multisig_program::ProposalVoteArgs { memo: None },
        )?;

        let transaction = squads_multisig_program::state::VaultTransaction::try_from_slice(
            &ctx.accounts
                .squads_multisig_vault_transaction
                .to_account_info()
                .try_borrow_data()
                .unwrap()
                .as_ref()[8..],
        )?;

        let all_accounts = ctx.accounts.to_account_infos();

        let remaining_accounts = transaction
            .message
            .account_keys
            .iter()
            .map(|key| {
                all_accounts
                    .iter()
                    .find(|account| account.key() == *key)
                    .map(|account| account.to_account_info())
                    .unwrap()
            })
            .collect::<Vec<AccountInfo<'_>>>();

        squads_multisig_program::cpi::vault_transaction_execute(
            CpiContext::new_with_signer(
                ctx.accounts.squads_program.to_account_info(),
                squads_multisig_program::cpi::accounts::VaultTransactionExecute {
                    multisig: ctx.accounts.squads_multisig.to_account_info(),
                    proposal: ctx.accounts.squads_multisig_proposal.to_account_info(),
                    transaction: ctx
                        .accounts
                        .squads_multisig_vault_transaction
                        .to_account_info(),
                    member: ctx.accounts.dao.to_account_info(),
                },
                dao_signer,
            )
            .with_remaining_accounts(remaining_accounts),
        )?;

        // Reload token accounts and record token balances after the fee claim
        ctx.accounts
            .meteora_claim_position_fees_accounts
            .token_a_account
            .reload()?;
        ctx.accounts
            .meteora_claim_position_fees_accounts
            .token_b_account
            .reload()?;

        let base_token_account_balance_after = ctx
            .accounts
            .meteora_claim_position_fees_accounts
            .token_a_account
            .amount;
        let quote_token_account_balance_after = ctx
            .accounts
            .meteora_claim_position_fees_accounts
            .token_b_account
            .amount;

        let base_fees_collected =
            base_token_account_balance_after - base_token_account_balance_before;
        let quote_fees_collected =
            quote_token_account_balance_after - quote_token_account_balance_before;

        ctx.accounts.dao.seq_num += 1;

        emit_cpi!(CollectMeteoraDammFeesEvent {
            common: CommonFields::new(&Clock::get()?, ctx.accounts.dao.seq_num),
            dao: ctx.accounts.dao.key(),
            base_token_account: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_a_account
                .key(),
            quote_token_account: ctx
                .accounts
                .meteora_claim_position_fees_accounts
                .token_b_account
                .key(),
            pool: ctx.accounts.meteora_claim_position_fees_accounts.pool.key(),
            quote_mint: ctx.accounts.dao.quote_mint,
            base_mint: ctx.accounts.dao.base_mint,
            quote_fees_collected: quote_fees_collected,
            base_fees_collected: base_fees_collected,
        });

        Ok(())
    }
}

/// Compiles a Solana instruction into a Squads TransactionMessage format.
/// This is necessary because Solana's Message::serialize() uses a different header format
/// (num_readonly_signed_accounts, num_readonly_unsigned_accounts) than Squads expects
/// (num_writable_signers, num_writable_non_signers).
fn compile_transaction_message(
    vault_key: &Pubkey,
    instructions: &[anchor_lang::solana_program::instruction::Instruction],
) -> Result<squads_multisig_program::TransactionMessage> {
    // Track account metadata: (is_signer, is_writable)
    let mut key_meta_map: BTreeMap<Pubkey, (bool, bool)> = BTreeMap::new();

    // Add vault as a writable signer (matches Squads SDK payer semantics)
    key_meta_map.insert(*vault_key, (true, true));

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
            // Vault key should be first among writable signers (matches Squads SDK)
            if *pubkey == *vault_key {
                writable_signers.insert(0, *pubkey);
            } else {
                writable_signers.push(*pubkey);
            }
        } else if *is_signer {
            readonly_signers.push(*pubkey);
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
