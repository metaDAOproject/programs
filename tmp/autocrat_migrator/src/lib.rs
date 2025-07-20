//! A program to help autocrat migrate by transferring both its META and USDC
//! to the new autocrat.

use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};

declare_id!("MigRDW6uxyNMDBD8fX2njCRyJC4YZk2Rx9pDUZiAESt");

#[program]
pub mod autocrat_migrator {
    use super::*;

    pub fn multi_transfer2(ctx: Context<MultiTransfer2>) -> Result<()> {
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.from0.to_account_info(),
                    to: ctx.accounts.to0.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            ctx.accounts.from0.amount,
        )?;

        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.from1.to_account_info(),
                    to: ctx.accounts.to1.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            ctx.accounts.from1.amount,
        )?;

        let rent = Rent::get()?;

        let lamport_transfer = solana_program::system_instruction::transfer(
            &ctx.accounts.authority.key(),
            &ctx.accounts.lamport_receiver.key(),
            ctx.accounts
                .authority
                .get_lamports()
                .saturating_sub(rent.minimum_balance(0)),
        );

        solana_program::program::invoke(
            &lamport_transfer,
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.lamport_receiver.to_account_info(),
            ],
        )?;

        Ok(())
    }

    pub fn multi_transfer4(ctx: Context<MultiTransfer4>) -> Result<()> {
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.from0.to_account_info(),
                    to: ctx.accounts.to0.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            ctx.accounts.from0.amount,
        )?;

        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.from1.to_account_info(),
                    to: ctx.accounts.to1.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            ctx.accounts.from1.amount,
        )?;

        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.from2.to_account_info(),
                    to: ctx.accounts.to2.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            ctx.accounts.from2.amount,
        )?;

        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.from3.to_account_info(),
                    to: ctx.accounts.to3.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            ctx.accounts.from3.amount,
        )?;

        let rent = Rent::get()?;

        let lamport_transfer = solana_program::system_instruction::transfer(
            &ctx.accounts.authority.key(),
            &ctx.accounts.lamport_receiver.key(),
            ctx.accounts
                .authority
                .get_lamports()
                .saturating_sub(rent.minimum_balance(0)),
        );

        solana_program::program::invoke(
            &lamport_transfer,
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.lamport_receiver.to_account_info(),
            ],
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct MultiTransfer2<'info> {
    token_program: Program<'info, Token>,
    #[account(mut)]
    authority: Signer<'info>,
    #[account(mut)]
    from0: Account<'info, TokenAccount>,
    #[account(mut)]
    to0: Account<'info, TokenAccount>,
    #[account(mut)]
    from1: Account<'info, TokenAccount>,
    #[account(mut)]
    to1: Account<'info, TokenAccount>,
    system_program: Program<'info, System>,
    /// CHECK: no r/w, just lamport sub
    #[account(mut)]
    lamport_receiver: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct MultiTransfer4<'info> {
    token_program: Program<'info, Token>,
    #[account(mut)]
    authority: Signer<'info>,
    #[account(mut)]
    from0: Account<'info, TokenAccount>,
    #[account(mut)]
    to0: Account<'info, TokenAccount>,
    #[account(mut)]
    from1: Account<'info, TokenAccount>,
    #[account(mut)]
    to1: Account<'info, TokenAccount>,
    #[account(mut)]
    from2: Account<'info, TokenAccount>,
    #[account(mut)]
    to2: Account<'info, TokenAccount>,
    #[account(mut)]
    from3: Account<'info, TokenAccount>,
    #[account(mut)]
    to3: Account<'info, TokenAccount>,
    system_program: Program<'info, System>,
    /// CHECK: no r/w, just lamport sub
    #[account(mut)]
    lamport_receiver: UncheckedAccount<'info>,
}
