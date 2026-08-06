//! Types for reading pump_amm accounts, plus hand-built CPI builders —
//! pump_amm ships no Anchor-0.29 crate. Discriminators and args come from
//! pump_amm's IDL; the deployed program is newer than that IDL and requires a
//! remaining-accounts tail past the published list — the `pool_v2` PDA plus
//! one buyback fee recipient with its quote ATA (verified against live
//! mainnet swaps 2026-08-04).
use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;

use crate::error::RelaunchError;
use crate::pump_amm_program;

pub const POOL_DISCRIMINATOR: [u8; 8] = [241, 154, 109, 4, 17, 177, 109, 188];

pub const SELL_DISCRIMINATOR: [u8; 8] = [51, 230, 133, 164, 1, 127, 131, 173];

/// The prefix of pump_amm's `Pool` account that canonicality validation
/// reads; trailing fields are ignored.
#[derive(AnchorDeserialize)]
pub struct PumpSwapPool {
    pub pool_bump: u8,
    pub index: u16,
    pub creator: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
}

impl PumpSwapPool {
    pub fn try_parse(data: &[u8]) -> Result<Self> {
        require!(
            data.len() > POOL_DISCRIMINATOR.len() && data[..8] == POOL_DISCRIMINATOR,
            RelaunchError::SourcePoolNotCanonical
        );
        Self::deserialize(&mut &data[8..])
            .map_err(|_| error!(RelaunchError::SourcePoolNotCanonical))
    }
}

/// The accounts of pump_amm's `sell`, in instruction order.
pub struct Sell<'info> {
    pub pool: AccountInfo<'info>,
    pub user: AccountInfo<'info>,
    pub global_config: AccountInfo<'info>,
    pub base_mint: AccountInfo<'info>,
    pub quote_mint: AccountInfo<'info>,
    pub user_base_token_account: AccountInfo<'info>,
    pub user_quote_token_account: AccountInfo<'info>,
    pub pool_base_token_account: AccountInfo<'info>,
    pub pool_quote_token_account: AccountInfo<'info>,
    pub protocol_fee_recipient: AccountInfo<'info>,
    pub protocol_fee_recipient_token_account: AccountInfo<'info>,
    pub base_token_program: AccountInfo<'info>,
    pub quote_token_program: AccountInfo<'info>,
    pub system_program: AccountInfo<'info>,
    pub associated_token_program: AccountInfo<'info>,
    pub event_authority: AccountInfo<'info>,
    pub program: AccountInfo<'info>,
    pub coin_creator_vault_ata: AccountInfo<'info>,
    pub coin_creator_vault_authority: AccountInfo<'info>,
    pub fee_config: AccountInfo<'info>,
    pub fee_program: AccountInfo<'info>,
    // remaining-accounts tail
    pub pool_v2: AccountInfo<'info>,
    pub buyback_fee_recipient: AccountInfo<'info>,
    pub buyback_fee_recipient_token_account: AccountInfo<'info>,
}

pub fn sell(
    accounts: Sell,
    base_amount_in: u64,
    min_quote_amount_out: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let mut data = Vec::with_capacity(24);
    data.extend_from_slice(&SELL_DISCRIMINATOR);
    data.extend_from_slice(&base_amount_in.to_le_bytes());
    data.extend_from_slice(&min_quote_amount_out.to_le_bytes());

    let metas = vec![
        AccountMeta::new(accounts.pool.key(), false),
        AccountMeta::new(accounts.user.key(), true),
        AccountMeta::new_readonly(accounts.global_config.key(), false),
        AccountMeta::new_readonly(accounts.base_mint.key(), false),
        AccountMeta::new_readonly(accounts.quote_mint.key(), false),
        AccountMeta::new(accounts.user_base_token_account.key(), false),
        AccountMeta::new(accounts.user_quote_token_account.key(), false),
        AccountMeta::new(accounts.pool_base_token_account.key(), false),
        AccountMeta::new(accounts.pool_quote_token_account.key(), false),
        AccountMeta::new_readonly(accounts.protocol_fee_recipient.key(), false),
        AccountMeta::new(accounts.protocol_fee_recipient_token_account.key(), false),
        AccountMeta::new_readonly(accounts.base_token_program.key(), false),
        AccountMeta::new_readonly(accounts.quote_token_program.key(), false),
        AccountMeta::new_readonly(accounts.system_program.key(), false),
        AccountMeta::new_readonly(accounts.associated_token_program.key(), false),
        AccountMeta::new_readonly(accounts.event_authority.key(), false),
        AccountMeta::new_readonly(accounts.program.key(), false),
        AccountMeta::new(accounts.coin_creator_vault_ata.key(), false),
        AccountMeta::new_readonly(accounts.coin_creator_vault_authority.key(), false),
        AccountMeta::new_readonly(accounts.fee_config.key(), false),
        AccountMeta::new_readonly(accounts.fee_program.key(), false),
        AccountMeta::new_readonly(accounts.pool_v2.key(), false),
        AccountMeta::new_readonly(accounts.buyback_fee_recipient.key(), false),
        AccountMeta::new(accounts.buyback_fee_recipient_token_account.key(), false),
    ];

    let account_infos = [
        accounts.pool,
        accounts.user,
        accounts.global_config,
        accounts.base_mint,
        accounts.quote_mint,
        accounts.user_base_token_account,
        accounts.user_quote_token_account,
        accounts.pool_base_token_account,
        accounts.pool_quote_token_account,
        accounts.protocol_fee_recipient,
        accounts.protocol_fee_recipient_token_account,
        accounts.base_token_program,
        accounts.quote_token_program,
        accounts.system_program,
        accounts.associated_token_program,
        accounts.event_authority,
        accounts.program,
        accounts.coin_creator_vault_ata,
        accounts.coin_creator_vault_authority,
        accounts.fee_config,
        accounts.fee_program,
        accounts.pool_v2,
        accounts.buyback_fee_recipient,
        accounts.buyback_fee_recipient_token_account,
    ];

    invoke_signed(
        &Instruction {
            program_id: pump_amm_program::id(),
            accounts: metas,
            data,
        },
        &account_infos,
        signer_seeds,
    )?;

    Ok(())
}
