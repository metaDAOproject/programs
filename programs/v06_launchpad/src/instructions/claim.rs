use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchClaimEvent};
use crate::state::{FundingRecord, Launch, LaunchState};
use crate::TOKENS_TO_PARTICIPANTS;

#[event_cpi]
#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(
        mut,
        has_one = launch_signer,
        has_one = base_mint,
        has_one = launch_base_vault,
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

    /// CHECK: just a signer
    pub launch_signer: UncheckedAccount<'info>,

    pub base_mint: Account<'info, Mint>,

    #[account(mut)]
    pub launch_base_vault: Account<'info, TokenAccount>,

    /// CHECK: not used, just for constraints
    pub funder: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = funder
    )]
    pub funder_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl Claim<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.launch.state == LaunchState::Complete,
            LaunchpadError::InvalidLaunchState
        );

        require!(
            !self.funding_record.is_tokens_claimed,
            LaunchpadError::TokensAlreadyClaimed
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        let funding_record = &mut ctx.accounts.funding_record;
        let launch_key = launch.key();

        // Calculate tokens to transfer based on contribution percentage
        let token_amount = (funding_record.committed_amount as u128)
            .checked_mul(TOKENS_TO_PARTICIPANTS as u128)
            .unwrap()
            .checked_div(launch.total_committed_amount as u128)
            .unwrap() as u64;

        let seeds = &[
            b"launch_signer",
            launch_key.as_ref(),
            &[launch.launch_signer_pda_bump],
        ];
        let signer = &[&seeds[..]];

        funding_record.is_tokens_claimed = true;

        // Transfer tokens from vault to funder
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.launch_base_vault.to_account_info(),
                    to: ctx.accounts.funder_token_account.to_account_info(),
                    authority: ctx.accounts.launch_signer.to_account_info(),
                },
                signer,
            ),
            token_amount,
        )?;

        launch.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(LaunchClaimEvent {
            common: CommonFields::new(&clock, launch.seq_num),
            launch: launch.key(),
            funder: ctx.accounts.funder.key(),
            tokens_claimed: token_amount,
            funding_record: funding_record.key(),
        });

        Ok(())
    }
}
