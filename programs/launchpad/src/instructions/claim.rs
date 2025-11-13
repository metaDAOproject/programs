use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchClaimEvent};
use crate::state::{FundingRecord, Launch, LaunchState};
use crate::utils::apply_funding_fee;
use crate::{FUNDING_FEE_WALLET, TOKENS_TO_PARTICIPANTS};

#[event_cpi]
#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(
        mut,
        has_one = launch_signer,
        has_one = base_mint,
        has_one = quote_mint,
        has_one = launch_base_vault,
        has_one = launch_quote_vault,
    )]
    pub launch: Account<'info, Launch>,

    #[account(
        mut,
        has_one = funder,
        seeds = [b"funding_record", launch.key().as_ref(), funder.key().as_ref()],
        bump = funding_record.pda_bump
    )]
    pub funding_record: Account<'info, FundingRecord>,

    /// CHECK: just a signer
    pub launch_signer: UncheckedAccount<'info>,

    pub base_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,

    #[account(mut)]
    pub launch_base_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub launch_quote_vault: Account<'info, TokenAccount>,

    /// CHECK: not used, just for constraints
    pub funder: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = funder
    )]
    pub funder_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = FUNDING_FEE_WALLET
    )]
    pub funding_fee_wallet: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
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

        let (launch_total_committed_amount_after_fees, _launch_total_fee_amount) =
            apply_funding_fee(launch.total_committed_amount);

        let (amount_after_fees, fee_amount) = apply_funding_fee(funding_record.committed_amount);

        // Calculate tokens to transfer to funder based on contribution proportion
        let token_amount = (TOKENS_TO_PARTICIPANTS as u128)
            .checked_mul(amount_after_fees as u128)
            .unwrap()
            .checked_div(launch_total_committed_amount_after_fees as u128)
            .unwrap() as u64;

        // Calculate fee amount to transfer to fee wallet based on contribution proportion
        let fee_amount_adjusted = (fee_amount as u128)
            .checked_mul(amount_after_fees as u128)
            .unwrap()
            .checked_div(launch_total_committed_amount_after_fees as u128)
            .unwrap() as u64;

        let seeds = &[
            b"launch_signer",
            launch_key.as_ref(),
            &[launch.launch_signer_pda_bump],
        ];
        let signer = &[&seeds[..]];

        funding_record.is_tokens_claimed = true;

        msg!("token_amount: {}", token_amount);
        msg!("fee_amount: {}", fee_amount_adjusted);
        msg!(
            "vault usdc amount: {}",
            ctx.accounts.launch_quote_vault.amount
        );

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

        // Transfer fee to funding fee wallet
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.launch_quote_vault.to_account_info(),
                    to: ctx.accounts.funding_fee_wallet.to_account_info(),
                    authority: ctx.accounts.launch_signer.to_account_info(),
                },
                signer,
            ),
            fee_amount_adjusted,
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
