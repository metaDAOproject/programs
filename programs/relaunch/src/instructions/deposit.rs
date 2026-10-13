use anchor_lang::prelude::*;
use anchor_spl::token_interface;

use crate::error::RelaunchError;
use crate::events::{CommonFields, TokensDepositedEvent};
use crate::state::{DepositRecord, Relaunch, RelaunchState};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DepositArgs {
    pub amount: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        has_one = old_mint,
        has_one = old_token_vault,
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

    #[account(mint::token_program = old_token_program)]
    pub old_mint: Box<InterfaceAccount<'info, token_interface::Mint>>,

    #[account(mut)]
    pub old_token_vault: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    pub depositor: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = old_mint,
        associated_token::authority = depositor,
        associated_token::token_program = old_token_program,
    )]
    pub depositor_token_account: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub old_token_program: Interface<'info, token_interface::TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl Deposit<'_> {
    pub fn validate(&self, args: &DepositArgs) -> Result<()> {
        require!(
            self.relaunch.state == RelaunchState::Live,
            RelaunchError::RelaunchNotLive
        );

        let clock = Clock::get()?;
        require_gt!(
            self.relaunch.unix_timestamp_started.unwrap()
                + self.relaunch.seconds_for_deposits as i64,
            clock.unix_timestamp,
            RelaunchError::DepositWindowClosed
        );

        require_gt!(args.amount, 0, RelaunchError::InvalidAmount);

        require_gte!(
            self.depositor_token_account.amount,
            args.amount,
            RelaunchError::InsufficientFunds
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: DepositArgs) -> Result<()> {
        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.old_token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: ctx.accounts.depositor_token_account.to_account_info(),
                    mint: ctx.accounts.old_mint.to_account_info(),
                    to: ctx.accounts.old_token_vault.to_account_info(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            args.amount,
            ctx.accounts.old_mint.decimals,
        )?;

        ctx.accounts.deposit_record.credit(
            ctx.accounts.relaunch.key(),
            ctx.accounts.depositor.key(),
            args.amount,
            ctx.bumps.deposit_record,
        );

        let relaunch = &mut ctx.accounts.relaunch;
        relaunch.total_deposited += args.amount;
        relaunch.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(TokensDepositedEvent {
            common: CommonFields::new(&clock, ctx.accounts.relaunch.seq_num),
            relaunch: ctx.accounts.relaunch.key(),
            depositor: ctx.accounts.depositor.key(),
            deposit_record: ctx.accounts.deposit_record.key(),
            amount: args.amount,
            total_deposited: ctx.accounts.relaunch.total_deposited,
            total_deposited_by_depositor: ctx.accounts.deposit_record.amount_deposited,
            deposit_record_seq_num: ctx.accounts.deposit_record.seq_num,
        });

        Ok(())
    }
}
