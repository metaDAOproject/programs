use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::{invoke, invoke_signed};
use anchor_spl::token::spl_token;
use anchor_spl::token::{Mint, Token};

use crate::{
    CommonFields, GatedInvokeEvent, GatedMintConfig, GatedMintError, WhitelistedUser,
    GATED_MINT_CONFIG_SEED, TOKEN_ACCOUNT_LEN, TOKEN_ACCOUNT_MINT_OFFSET,
    TOKEN_ACCOUNT_STATE_OFFSET, TOKEN_STATE_FROZEN, TOKEN_STATE_INITIALIZED, WHITELISTED_PROGRAMS,
    WHITELISTED_USER_SEED,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GatedInvokeArgs {
    pub instruction_data: Vec<u8>,
}

#[event_cpi]
#[derive(Accounts)]
pub struct GatedInvoke<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        has_one = mint @ GatedMintError::MintMismatch,
        constraint = !gated_mint_config.gating_disabled @ GatedMintError::GatingDisabled,
    )]
    pub gated_mint_config: Account<'info, GatedMintConfig>,

    #[account(
        seeds = [WHITELISTED_USER_SEED, mint.key().as_ref(), caller.key().as_ref()],
        bump = whitelisted_user.bump,
        has_one = mint @ GatedMintError::MintMismatch,
    )]
    pub whitelisted_user: Account<'info, WhitelistedUser>,

    pub mint: Account<'info, Mint>,

    /// CHECK: validated against WHITELISTED_PROGRAMS.
    pub target_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

impl<'info, 'c: 'info> GatedInvoke<'info> {
    pub fn validate(&self, _args: &GatedInvokeArgs) -> Result<()> {
        let target = self.target_program.key();
        require!(
            WHITELISTED_PROGRAMS.contains(&target),
            GatedMintError::TargetProgramNotWhitelisted
        );
        require_keys_neq!(target, crate::ID, GatedMintError::SelfInvocation);
        Ok(())
    }

    pub fn handle(ctx: Context<'_, '_, 'c, 'info, Self>, args: GatedInvokeArgs) -> Result<()> {
        let mint_key = ctx.accounts.mint.key();
        let cfg_key = ctx.accounts.gated_mint_config.key();
        let cfg_bump = ctx.accounts.gated_mint_config.bump;
        let signer_seeds: &[&[&[u8]]] =
            &[&[GATED_MINT_CONFIG_SEED, mint_key.as_ref(), &[cfg_bump]]];

        let mut thawed_count: u32 = 0;
        for acc in ctx.remaining_accounts.iter() {
            if !is_gated_mint_token_account(acc, &mint_key)? {
                continue;
            }
            if read_token_state(acc)? != TOKEN_STATE_FROZEN {
                continue;
            }
            cpi_thaw(
                &ctx.accounts.token_program.to_account_info(),
                acc,
                &ctx.accounts.mint.to_account_info(),
                &ctx.accounts.gated_mint_config.to_account_info(),
                signer_seeds,
            )?;
            thawed_count = thawed_count.saturating_add(1);
        }

        let account_metas: Vec<AccountMeta> = ctx
            .remaining_accounts
            .iter()
            .map(|a| AccountMeta {
                pubkey: a.key(),
                is_signer: a.is_signer,
                is_writable: a.is_writable,
            })
            .collect();
        let mut account_infos: Vec<AccountInfo> = ctx.remaining_accounts.to_vec();
        account_infos.push(ctx.accounts.target_program.to_account_info());

        let ix = Instruction {
            program_id: ctx.accounts.target_program.key(),
            accounts: account_metas,
            data: args.instruction_data,
        };
        invoke(&ix, &account_infos)?;

        let mut frozen_count: u32 = 0;
        for acc in ctx.remaining_accounts.iter() {
            if !is_gated_mint_token_account(acc, &mint_key)? {
                continue;
            }
            if read_token_state(acc)? != TOKEN_STATE_INITIALIZED {
                continue;
            }
            cpi_freeze(
                &ctx.accounts.token_program.to_account_info(),
                acc,
                &ctx.accounts.mint.to_account_info(),
                &ctx.accounts.gated_mint_config.to_account_info(),
                signer_seeds,
            )?;
            frozen_count = frozen_count.saturating_add(1);
        }

        let cfg = &mut ctx.accounts.gated_mint_config;
        cfg.seq_num += 1;
        let clock = Clock::get()?;
        emit_cpi!(GatedInvokeEvent {
            common: CommonFields::new(&clock, cfg.seq_num),
            gated_mint_config: cfg_key,
            mint: mint_key,
            caller: ctx.accounts.caller.key(),
            target_program: ctx.accounts.target_program.key(),
            thawed_count,
            frozen_count,
        });

        Ok(())
    }
}

fn is_gated_mint_token_account(acc: &AccountInfo, expected_mint: &Pubkey) -> Result<bool> {
    if acc.owner != &spl_token::ID {
        return Ok(false);
    }
    let data = acc.try_borrow_data()?;
    if data.len() != TOKEN_ACCOUNT_LEN {
        return Ok(false);
    }
    let mint_bytes: &[u8; 32] = data[TOKEN_ACCOUNT_MINT_OFFSET..TOKEN_ACCOUNT_MINT_OFFSET + 32]
        .try_into()
        .unwrap();
    Ok(Pubkey::from(*mint_bytes) == *expected_mint)
}

fn read_token_state(acc: &AccountInfo) -> Result<u8> {
    let data = acc.try_borrow_data()?;
    Ok(data[TOKEN_ACCOUNT_STATE_OFFSET])
}

fn cpi_thaw<'info>(
    token_program: &AccountInfo<'info>,
    account: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let ix = spl_token::instruction::thaw_account(
        &spl_token::ID,
        account.key,
        mint.key,
        authority.key,
        &[],
    )?;
    invoke_signed(
        &ix,
        &[
            account.clone(),
            mint.clone(),
            authority.clone(),
            token_program.clone(),
        ],
        signer_seeds,
    )?;
    Ok(())
}

fn cpi_freeze<'info>(
    token_program: &AccountInfo<'info>,
    account: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let ix = spl_token::instruction::freeze_account(
        &spl_token::ID,
        account.key,
        mint.key,
        authority.key,
        &[],
    )?;
    invoke_signed(
        &ix,
        &[
            account.clone(),
            mint.clone(),
            authority.clone(),
            token_program.clone(),
        ],
        signer_seeds,
    )?;
    Ok(())
}
