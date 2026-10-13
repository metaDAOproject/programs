use anchor_lang::prelude::*;
use anchor_spl::token_interface;

use crate::error::RelaunchError;
use crate::events::{CommonFields, RefundClaimedEvent};
use crate::state::{DepositRecord, Relaunch, RelaunchState};

#[event_cpi]
#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(
        mut,
        has_one = old_mint,
        has_one = old_token_vault,
        has_one = relaunch_signer,
    )]
    pub relaunch: Box<Account<'info, Relaunch>>,

    #[account(
        mut,
        has_one = relaunch,
        has_one = depositor,
        seeds = [b"deposit_record", relaunch.key().as_ref(), depositor.key().as_ref()],
        bump = deposit_record.pda_bump
    )]
    pub deposit_record: Box<Account<'info, DepositRecord>>,

    #[account(mint::token_program = old_token_program)]
    pub old_mint: Box<InterfaceAccount<'info, token_interface::Mint>>,

    #[account(mut)]
    pub old_token_vault: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    /// CHECK: just a signer
    pub relaunch_signer: UncheckedAccount<'info>,

    /// CHECK: the refund recipient; not required to sign, so anyone can crank
    /// refunds for any depositor.
    pub depositor: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = old_mint,
        associated_token::authority = depositor,
        associated_token::token_program = old_token_program,
    )]
    pub depositor_token_account: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    pub old_token_program: Interface<'info, token_interface::TokenInterface>,
}

impl ClaimRefund<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.relaunch.state == RelaunchState::Failed,
            RelaunchError::RelaunchNotFailed
        );

        require!(!self.deposit_record.claimed, RelaunchError::AlreadyClaimed);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let relaunch_key = ctx.accounts.relaunch.key();

        let seeds = &[
            b"relaunch_signer",
            relaunch_key.as_ref(),
            &[ctx.accounts.relaunch.relaunch_signer_bump],
        ];
        let signer = &[&seeds[..]];

        let deposit_record = &mut ctx.accounts.deposit_record;
        deposit_record.claimed = true;
        deposit_record.seq_num += 1;

        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.old_token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: ctx.accounts.old_token_vault.to_account_info(),
                    mint: ctx.accounts.old_mint.to_account_info(),
                    to: ctx.accounts.depositor_token_account.to_account_info(),
                    authority: ctx.accounts.relaunch_signer.to_account_info(),
                },
                signer,
            ),
            ctx.accounts.deposit_record.amount_deposited,
            ctx.accounts.old_mint.decimals,
        )?;

        let relaunch = &mut ctx.accounts.relaunch;
        relaunch.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(RefundClaimedEvent {
            common: CommonFields::new(&clock, ctx.accounts.relaunch.seq_num),
            relaunch: relaunch_key,
            depositor: ctx.accounts.depositor.key(),
            deposit_record: ctx.accounts.deposit_record.key(),
            amount_refunded: ctx.accounts.deposit_record.amount_deposited,
            deposit_record_seq_num: ctx.accounts.deposit_record.seq_num,
        });

        Ok(())
    }
}
