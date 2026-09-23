//! Hand-built CPI builder for Orca Whirlpool's `swap_v2` — the same pattern
//! as `pump_amm.rs`, since a generated client crate is not worth a new
//! dependency for a single instruction.
use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;

use crate::whirlpool_program;

pub const SWAP_V2_DISCRIMINATOR: [u8; 8] = [43, 4, 237, 11, 26, 201, 30, 98];

/// Whirlpool's global minimum sqrt price; passing it as the price limit of an
/// a→b swap means "no limit beyond the pool's own bounds".
pub const MIN_SQRT_PRICE: u128 = 4_295_048_016;

/// The accounts of whirlpool's `swap_v2`, in instruction order.
pub struct SwapV2<'info> {
    pub token_program_a: AccountInfo<'info>,
    pub token_program_b: AccountInfo<'info>,
    pub memo_program: AccountInfo<'info>,
    pub token_authority: AccountInfo<'info>,
    pub whirlpool: AccountInfo<'info>,
    pub token_mint_a: AccountInfo<'info>,
    pub token_mint_b: AccountInfo<'info>,
    pub token_owner_account_a: AccountInfo<'info>,
    pub token_vault_a: AccountInfo<'info>,
    pub token_owner_account_b: AccountInfo<'info>,
    pub token_vault_b: AccountInfo<'info>,
    pub tick_array_0: AccountInfo<'info>,
    pub tick_array_1: AccountInfo<'info>,
    pub tick_array_2: AccountInfo<'info>,
    pub oracle: AccountInfo<'info>,
}

pub fn swap_v2(
    accounts: SwapV2,
    amount: u64,
    other_amount_threshold: u64,
    sqrt_price_limit: u128,
    amount_specified_is_input: bool,
    a_to_b: bool,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let mut data = Vec::with_capacity(43);
    data.extend_from_slice(&SWAP_V2_DISCRIMINATOR);
    data.extend_from_slice(&amount.to_le_bytes());
    data.extend_from_slice(&other_amount_threshold.to_le_bytes());
    data.extend_from_slice(&sqrt_price_limit.to_le_bytes());
    data.push(amount_specified_is_input as u8);
    data.push(a_to_b as u8);
    // remaining_accounts_info: Option<RemainingAccountsInfo> = None
    data.push(0);

    let metas = vec![
        AccountMeta::new_readonly(accounts.token_program_a.key(), false),
        AccountMeta::new_readonly(accounts.token_program_b.key(), false),
        AccountMeta::new_readonly(accounts.memo_program.key(), false),
        AccountMeta::new_readonly(accounts.token_authority.key(), true),
        AccountMeta::new(accounts.whirlpool.key(), false),
        AccountMeta::new_readonly(accounts.token_mint_a.key(), false),
        AccountMeta::new_readonly(accounts.token_mint_b.key(), false),
        AccountMeta::new(accounts.token_owner_account_a.key(), false),
        AccountMeta::new(accounts.token_vault_a.key(), false),
        AccountMeta::new(accounts.token_owner_account_b.key(), false),
        AccountMeta::new(accounts.token_vault_b.key(), false),
        AccountMeta::new(accounts.tick_array_0.key(), false),
        AccountMeta::new(accounts.tick_array_1.key(), false),
        AccountMeta::new(accounts.tick_array_2.key(), false),
        AccountMeta::new(accounts.oracle.key(), false),
    ];

    let account_infos = [
        accounts.token_program_a,
        accounts.token_program_b,
        accounts.memo_program,
        accounts.token_authority,
        accounts.whirlpool,
        accounts.token_mint_a,
        accounts.token_mint_b,
        accounts.token_owner_account_a,
        accounts.token_vault_a,
        accounts.token_owner_account_b,
        accounts.token_vault_b,
        accounts.tick_array_0,
        accounts.tick_array_1,
        accounts.tick_array_2,
        accounts.oracle,
    ];

    invoke_signed(
        &Instruction {
            program_id: whirlpool_program::id(),
            accounts: metas,
            data,
        },
        &account_infos,
        signer_seeds,
    )?;

    Ok(())
}
