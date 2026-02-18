use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchFundedEvent};
use crate::state::{FundingRecord, Launch, LaunchState};

#[event_cpi]
#[derive(Accounts)]
pub struct Fund<'info> {
    #[account(
        mut,
        has_one = launch_signer,
        has_one = launch_quote_vault,
    )]
    pub launch: Account<'info, Launch>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + FundingRecord::INIT_SPACE,
        seeds = [b"funding_record", launch.key().as_ref(), funder.key().as_ref()],
        bump
    )]
    pub funding_record: Account<'info, FundingRecord>,

    /// CHECK: just a signer
    pub launch_signer: UncheckedAccount<'info>,

    #[account(mut)]
    pub launch_quote_vault: Account<'info, TokenAccount>,

    pub funder: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = launch.quote_mint,
        associated_token::authority = funder
    )]
    pub funder_quote_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl Fund<'_> {
    pub fn validate(&self, amount: u64) -> Result<()> {
        require!(amount > 0, LaunchpadError::InvalidAmount);

        require_gte!(
            self.funder_quote_account.amount,
            amount,
            LaunchpadError::InsufficientFunds
        );

        require!(
            self.launch.state == LaunchState::Live,
            LaunchpadError::InvalidLaunchState
        );

        let clock = Clock::get()?;

        require_gt!(
            self.launch.unix_timestamp_started.unwrap() + self.launch.seconds_for_launch as i64,
            clock.unix_timestamp,
            LaunchpadError::LaunchExpired
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, amount: u64) -> Result<()> {
        // Transfer quote tokens from funder to vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.funder_quote_account.to_account_info(),
                    to: ctx.accounts.launch_quote_vault.to_account_info(),
                    authority: ctx.accounts.funder.to_account_info(),
                },
            ),
            amount,
        )?;

        let funding_record = &mut ctx.accounts.funding_record;

        if funding_record.funder == ctx.accounts.funder.key() {
            funding_record.committed_amount += amount;
        } else {
            funding_record.set_inner(FundingRecord {
                pda_bump: ctx.bumps.funding_record,
                funder: ctx.accounts.funder.key(),
                launch: ctx.accounts.launch.key(),
                committed_amount: amount,
                is_tokens_claimed: false,
                is_usdc_refunded: false,
                approved_amount: 0,
            });
        }

        // Update committed amount
        ctx.accounts.launch.total_committed_amount += amount;

        ctx.accounts.launch.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(LaunchFundedEvent {
            common: CommonFields::new(&clock, ctx.accounts.launch.seq_num),
            launch: ctx.accounts.launch.key(),
            funder: ctx.accounts.funder.key(),
            amount,
            total_committed: ctx.accounts.launch.total_committed_amount,
            funding_record: funding_record.key(),
            total_committed_by_funder: funding_record.committed_amount,
        });

        Ok(())
    }
}
