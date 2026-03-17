use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchRefundedEvent};
use crate::state::{FundingRecord, Launch, LaunchState};

#[event_cpi]
#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        mut,
        has_one = launch_quote_vault,
        has_one = launch_signer,
    )]
    pub launch: Account<'info, Launch>,

    #[account(
        mut,
        has_one = launch,
        has_one = funder,
        seeds = [b"funding_record", launch.key().as_ref(), funder.key().as_ref()],
        bump = funding_record.pda_bump
    )]
    pub funding_record: Account<'info, FundingRecord>,

    #[account(mut)]
    pub launch_quote_vault: Account<'info, TokenAccount>,

    /// CHECK: just a signer
    pub launch_signer: UncheckedAccount<'info>,

    /// CHECK: not used, just for constraints
    pub funder: UncheckedAccount<'info>,

    #[account(mut, associated_token::mint = launch.quote_mint, associated_token::authority = funder)]
    pub funder_quote_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl Refund<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.launch.state == LaunchState::Refunding
                || (self.launch.state == LaunchState::Complete
                    && self.launch.final_raise_amount.unwrap()
                        < self.launch.total_committed_amount),
            LaunchpadError::LaunchNotRefunding
        );

        require!(
            !self.funding_record.is_usdc_refunded,
            LaunchpadError::MoneyAlreadyRefunded
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        let launch_key = launch.key();
        let funding_record = &mut ctx.accounts.funding_record;

        let amount_to_refund = match launch.state {
            LaunchState::Refunding => funding_record.committed_amount,
            LaunchState::Complete => {
                let numerator = (launch.final_raise_amount.unwrap() as u128)
                    .checked_mul(funding_record.committed_amount as u128)
                    .unwrap();
                let amount_used_to_buy = numerator
                    .checked_div(launch.total_committed_amount as u128)
                    .unwrap() as u64;

                let amount_used_to_buy = if numerator
                    .checked_rem(launch.total_committed_amount as u128)
                    .unwrap()
                    != 0
                {
                    amount_used_to_buy + 1
                } else {
                    amount_used_to_buy
                };

                funding_record.committed_amount - amount_used_to_buy
            }
            _ => unreachable!(),
        };

        let seeds = &[
            b"launch_signer",
            launch_key.as_ref(),
            &[launch.launch_signer_pda_bump],
        ];
        let signer = &[&seeds[..]];

        funding_record.is_usdc_refunded = true;

        // Transfer USDC back to the user
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.launch_quote_vault.to_account_info(),
                    to: ctx.accounts.funder_quote_account.to_account_info(),
                    authority: ctx.accounts.launch_signer.to_account_info(),
                },
                signer,
            ),
            amount_to_refund,
        )?;

        launch.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(LaunchRefundedEvent {
            common: CommonFields::new(&clock, launch.seq_num),
            launch: ctx.accounts.launch.key(),
            funder: ctx.accounts.funder.key(),
            usdc_refunded: amount_to_refund,
            funding_record: ctx.accounts.funding_record.key(),
        });

        Ok(())
    }
}
