use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::error::RelaunchError;
use crate::events::{CommonFields, TokensDepositedViaBuyEvent};
use crate::raydium_amm;
use crate::state::{DepositRecord, Relaunch, RelaunchState, SourceVenue};
use crate::{raydium_amm_authority, raydium_amm_program};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DepositViaBuyRaydiumArgs {
    /// The exact amount of old tokens to buy off the source pool
    /// (swap_base_out_v2 is exact-output).
    pub base_out: u64,
    /// The depositor's live slippage cap on the quote spent, inclusive of
    /// the AMM's 25 bps fee.
    pub max_quote_in: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct DepositViaBuyRaydium<'info> {
    #[account(
        mut,
        has_one = source_quote_mint,
        has_one = source_pool,
        has_one = relaunch_signer,
        has_one = old_token_vault,
        has_one = source_quote_vault,
    )]
    pub relaunch: Box<Account<'info, Relaunch>>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + DepositRecord::INIT_SPACE,
        seeds = [b"deposit_record", relaunch.key().as_ref(), depositor.key().as_ref()],
        bump
    )]
    pub deposit_record: Box<Account<'info, DepositRecord>>,

    pub depositor: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: the vault authority that signs the buy and the refund
    pub relaunch_signer: UncheckedAccount<'info>,

    pub source_quote_mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub old_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub source_quote_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = source_quote_mint,
        token::authority = depositor,
    )]
    pub depositor_quote_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: fingerprint-validated at init and pinned by has_one
    #[account(mut)]
    pub source_pool: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = raydium_amm_authority::id())]
    pub amm_authority: UncheckedAccount<'info>,

    /// CHECK: pinned against the pool's stored field in validate()
    #[account(mut)]
    pub amm_coin_vault: UncheckedAccount<'info>,

    /// CHECK: pinned against the pool's stored field in validate()
    #[account(mut)]
    pub amm_pc_vault: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = raydium_amm_program::id())]
    pub raydium_amm_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl DepositViaBuyRaydium<'_> {
    pub fn validate(&self, args: &DepositViaBuyRaydiumArgs) -> Result<()> {
        require!(
            self.relaunch.state == RelaunchState::Live,
            RelaunchError::RelaunchNotLive
        );

        require!(
            self.relaunch.source_venue == SourceVenue::RaydiumAmmV4,
            RelaunchError::WrongSourceVenue
        );

        let clock = Clock::get()?;
        require_gt!(
            self.relaunch.unix_timestamp_started.unwrap()
                + self.relaunch.seconds_for_deposits as i64,
            clock.unix_timestamp,
            RelaunchError::DepositWindowClosed
        );

        require_gt!(args.base_out, 0, RelaunchError::InvalidAmount);
        require_gt!(args.max_quote_in, 0, RelaunchError::InvalidAmount);

        require_gte!(
            self.depositor_quote_account.amount,
            args.max_quote_in,
            RelaunchError::InsufficientFunds
        );

        // Pin the vaults to the pool's stored fields.
        let pool = raydium_amm::RaydiumPool::try_parse(&self.source_pool.try_borrow_data()?)?;
        require_keys_eq!(
            self.amm_coin_vault.key(),
            pool.coin_vault,
            RelaunchError::SourcePoolNotCanonical
        );
        require_keys_eq!(
            self.amm_pc_vault.key(),
            pool.pc_vault,
            RelaunchError::SourcePoolNotCanonical
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: DepositViaBuyRaydiumArgs) -> Result<()> {
        let relaunch_key = ctx.accounts.relaunch.key();

        let seeds = &[
            b"relaunch_signer",
            relaunch_key.as_ref(),
            &[ctx.accounts.relaunch.relaunch_signer_bump],
        ];
        let signer = &[&seeds[..]];

        let old_before = ctx.accounts.old_token_vault.amount;
        let quote_vault_before = ctx.accounts.source_quote_vault.amount;

        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::TransferChecked {
                    from: ctx.accounts.depositor_quote_account.to_account_info(),
                    mint: ctx.accounts.source_quote_mint.to_account_info(),
                    to: ctx.accounts.source_quote_vault.to_account_info(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            args.max_quote_in,
            ctx.accounts.source_quote_mint.decimals,
        )?;

        // Exact-out: the CPI pulls only the input the buy needs from the
        // quote vault, leaving the rest for the refund below.
        raydium_amm::swap_base_out_v2(
            raydium_amm::Swap {
                token_program: ctx.accounts.token_program.to_account_info(),
                amm: ctx.accounts.source_pool.to_account_info(),
                amm_authority: ctx.accounts.amm_authority.to_account_info(),
                amm_coin_vault: ctx.accounts.amm_coin_vault.to_account_info(),
                amm_pc_vault: ctx.accounts.amm_pc_vault.to_account_info(),
                user_source_token_account: ctx.accounts.source_quote_vault.to_account_info(),
                user_destination_token_account: ctx.accounts.old_token_vault.to_account_info(),
                user_source_owner: ctx.accounts.relaunch_signer.to_account_info(),
            },
            args.max_quote_in,
            args.base_out,
            signer,
        )?;

        ctx.accounts.old_token_vault.reload()?;
        ctx.accounts.source_quote_vault.reload()?;

        let tokens_bought = ctx.accounts.old_token_vault.amount - old_before;
        let quote_refund = ctx.accounts.source_quote_vault.amount - quote_vault_before;
        let quote_spent = args.max_quote_in - quote_refund;

        if quote_refund > 0 {
            token::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token::TransferChecked {
                        from: ctx.accounts.source_quote_vault.to_account_info(),
                        mint: ctx.accounts.source_quote_mint.to_account_info(),
                        to: ctx.accounts.depositor_quote_account.to_account_info(),
                        authority: ctx.accounts.relaunch_signer.to_account_info(),
                    },
                    signer,
                ),
                quote_refund,
                ctx.accounts.source_quote_mint.decimals,
            )?;
        }

        ctx.accounts.deposit_record.credit(
            relaunch_key,
            ctx.accounts.depositor.key(),
            tokens_bought,
            ctx.bumps.deposit_record,
        );

        let relaunch = &mut ctx.accounts.relaunch;
        relaunch.total_deposited += tokens_bought;
        relaunch.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(TokensDepositedViaBuyEvent {
            common: CommonFields::new(&clock, ctx.accounts.relaunch.seq_num),
            relaunch: relaunch_key,
            depositor: ctx.accounts.depositor.key(),
            deposit_record: ctx.accounts.deposit_record.key(),
            amount: tokens_bought,
            quote_spent,
            total_deposited: ctx.accounts.relaunch.total_deposited,
            total_deposited_by_depositor: ctx.accounts.deposit_record.amount_deposited,
            deposit_record_seq_num: ctx.accounts.deposit_record.seq_num,
        });

        Ok(())
    }
}
