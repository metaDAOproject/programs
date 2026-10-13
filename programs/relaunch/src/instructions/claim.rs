use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::error::RelaunchError;
use crate::events::{CommonFields, TokensClaimedEvent};
use crate::state::{DepositRecord, Relaunch, RelaunchState};
use crate::TOKENS_TO_DEPOSITORS;

#[event_cpi]
#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(
        mut,
        has_one = new_mint,
        has_one = new_token_vault,
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

    pub new_mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub new_token_vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: just a signer
    pub relaunch_signer: UncheckedAccount<'info>,

    /// CHECK: the claim recipient; not required to sign, so anyone can crank
    /// claims for any depositor.
    pub depositor: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = new_mint,
        associated_token::authority = depositor,
    )]
    pub depositor_token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

impl Claim<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.relaunch.state == RelaunchState::Complete,
            RelaunchError::RelaunchNotComplete
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

        // The depositor's floor pro-rata share of the depositor bucket;
        // rounding dust stays in the vault.
        let amount_claimed = u64::try_from(
            ctx.accounts.deposit_record.amount_deposited as u128 * TOKENS_TO_DEPOSITORS as u128
                / ctx.accounts.relaunch.total_deposited as u128,
        )
        .map_err(|_| RelaunchError::CastingOverflow)?;

        let deposit_record = &mut ctx.accounts.deposit_record;
        deposit_record.claimed = true;
        deposit_record.seq_num += 1;

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.new_token_vault.to_account_info(),
                    to: ctx.accounts.depositor_token_account.to_account_info(),
                    authority: ctx.accounts.relaunch_signer.to_account_info(),
                },
                signer,
            ),
            amount_claimed,
        )?;

        let relaunch = &mut ctx.accounts.relaunch;
        relaunch.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(TokensClaimedEvent {
            common: CommonFields::new(&clock, ctx.accounts.relaunch.seq_num),
            relaunch: relaunch_key,
            depositor: ctx.accounts.depositor.key(),
            deposit_record: ctx.accounts.deposit_record.key(),
            amount_claimed,
            deposit_record_seq_num: ctx.accounts.deposit_record.seq_num,
        });

        Ok(())
    }
}
