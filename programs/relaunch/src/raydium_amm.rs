//! Types for reading Raydium AMM v4 accounts, plus hand-built CPI builders —
//! AMM v4 is a native pre-Anchor program with no crate we can depend on. The
//! V2 swap instructions (tags 16/17) skip the dead orderbook entirely: 8
//! accounts, pool + vaults only, direction inferred from the source/
//! destination account mints (verified against live mainnet swaps and a
//! surfpool rehearsal 2026-08-12).
use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;

use crate::error::RelaunchError;
use crate::raydium_amm_program;

/// AmmInfo is a fixed-size packed struct the AMM casts zero-copy.
/// No discriminator, so the exact length is the shape check.
pub const AMM_INFO_LEN: usize = 752;

pub const SWAP_BASE_IN_V2_TAG: u8 = 16;
pub const SWAP_BASE_OUT_V2_TAG: u8 = 17;

/// The subset of AmmInfo that validation and the swap instructions read.
pub struct RaydiumPool {
    pub status: u64,            // @ 0
    pub coin_vault: Pubkey,     // @ 336
    pub pc_vault: Pubkey,       // @ 368
    pub coin_mint: Pubkey,      // @ 400 (WSOL on pump-migration pools)
    pub pc_mint: Pubkey,        // @ 432 (the token on pump-migration pools)
    pub lp_mint: Pubkey,        // @ 464
    pub market_program: Pubkey, // @ 560 (the orderbook fingerprint)
    pub lp_amount: u64,         // @ 720 (LP ever minted; burns don't decrement)
}

impl RaydiumPool {
    pub fn try_parse(data: &[u8]) -> Result<Self> {
        require_eq!(
            data.len(),
            AMM_INFO_LEN,
            RelaunchError::SourcePoolNotCanonical
        );
        Ok(Self {
            status: read_u64(data, 0),
            coin_vault: read_pubkey(data, 336),
            pc_vault: read_pubkey(data, 368),
            coin_mint: read_pubkey(data, 400),
            pc_mint: read_pubkey(data, 432),
            lp_mint: read_pubkey(data, 464),
            market_program: read_pubkey(data, 560),
            lp_amount: read_u64(data, 720),
        })
    }
}

fn read_u64(data: &[u8], offset: usize) -> u64 {
    u64::from_le_bytes(data[offset..offset + 8].try_into().unwrap())
}

fn read_pubkey(data: &[u8], offset: usize) -> Pubkey {
    Pubkey::new_from_array(data[offset..offset + 32].try_into().unwrap())
}

/// The accounts of AMM v4's V2 swap instructions, in instruction order,
/// identical for both legs. The AMM checks the vaults against pool state and
/// infers direction by matching the user source/destination mints against
/// coin/pc.
pub struct Swap<'info> {
    pub token_program: AccountInfo<'info>,
    pub amm: AccountInfo<'info>,
    pub amm_authority: AccountInfo<'info>,
    pub amm_coin_vault: AccountInfo<'info>,
    pub amm_pc_vault: AccountInfo<'info>,
    pub user_source_token_account: AccountInfo<'info>,
    pub user_destination_token_account: AccountInfo<'info>,
    pub user_source_owner: AccountInfo<'info>,
}

/// Exact input, floor on output. The sell leg.
pub fn swap_base_in_v2(
    accounts: Swap,
    amount_in: u64,
    minimum_amount_out: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    invoke_swap(
        accounts,
        SWAP_BASE_IN_V2_TAG,
        amount_in,
        minimum_amount_out,
        signer_seeds,
    )
}

/// Exact output, cap on input. Only the needed input is pulled from the
/// source account. The buy leg.
pub fn swap_base_out_v2(
    accounts: Swap,
    max_amount_in: u64,
    amount_out: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    invoke_swap(
        accounts,
        SWAP_BASE_OUT_V2_TAG,
        max_amount_in,
        amount_out,
        signer_seeds,
    )
}

fn invoke_swap(
    accounts: Swap,
    tag: u8,
    arg1: u64,
    arg2: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let mut data = Vec::with_capacity(17);
    data.push(tag);
    data.extend_from_slice(&arg1.to_le_bytes());
    data.extend_from_slice(&arg2.to_le_bytes());

    let metas = vec![
        AccountMeta::new_readonly(accounts.token_program.key(), false),
        AccountMeta::new(accounts.amm.key(), false),
        AccountMeta::new_readonly(accounts.amm_authority.key(), false),
        AccountMeta::new(accounts.amm_coin_vault.key(), false),
        AccountMeta::new(accounts.amm_pc_vault.key(), false),
        AccountMeta::new(accounts.user_source_token_account.key(), false),
        AccountMeta::new(accounts.user_destination_token_account.key(), false),
        // Readonly signer. Raydium doesn't require the owner writable.
        AccountMeta::new_readonly(accounts.user_source_owner.key(), true),
    ];

    let account_infos = [
        accounts.token_program,
        accounts.amm,
        accounts.amm_authority,
        accounts.amm_coin_vault,
        accounts.amm_pc_vault,
        accounts.user_source_token_account,
        accounts.user_destination_token_account,
        accounts.user_source_owner,
    ];

    invoke_signed(
        &Instruction {
            program_id: raydium_amm_program::id(),
            accounts: metas,
            data,
        },
        &account_infos,
        signer_seeds,
    )?;

    Ok(())
}
