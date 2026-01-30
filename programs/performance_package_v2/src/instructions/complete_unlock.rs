use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use mint_governor::{
    cpi::{accounts::MintTokens, mint_tokens},
    program::MintGovernor as MintGovernorProgram,
    state::{MintAuthority, MintGovernor},
    MintTokensArgs,
};

use crate::{
    CommonFields, PackageStatus, PerformancePackage, PerformancePackageError, UnlockCompletedEvent,
    PERFORMANCE_PACKAGE_SEED,
};

#[derive(Accounts)]
pub struct CompleteUnlock<'info> {
    #[account(
        mut,
        seeds = [PERFORMANCE_PACKAGE_SEED, performance_package.create_key.as_ref()],
        bump = performance_package.bump
    )]
    pub performance_package: Account<'info, PerformancePackage>,

    #[account(
        mut,
        address = performance_package.mint_governor @ PerformancePackageError::InvalidMintGovernor
    )]
    pub mint_governor: Account<'info, MintGovernor>,

    #[account(
        mut,
        address = performance_package.mint_authority @ PerformancePackageError::InvalidMintAuthority
    )]
    pub mint_authority: Account<'info, MintAuthority>,

    #[account(
        mut,
        address = performance_package.mint
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = performance_package.recipient
    )]
    pub recipient_ata: Account<'info, TokenAccount>,

    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub mint_governor_program: Program<'info, MintGovernorProgram>,
}

impl CompleteUnlock<'_> {
    pub fn validate(&self) -> Result<()> {
        let pp = &self.performance_package;

        // Signer must be authority or recipient
        require!(
            self.signer.key() == pp.authority || self.signer.key() == pp.recipient,
            PerformancePackageError::Unauthorized
        );

        // Must be in Unlocking status
        require!(
            pp.status == PackageStatus::Unlocking,
            PerformancePackageError::NotUnlocking
        );

        // Check if min_duration has passed (for Time oracle, always true)
        require!(
            pp.oracle_reader.can_end(),
            PerformancePackageError::OracleMinDurationNotReached
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let pp = &mut ctx.accounts.performance_package;

        // Record end snapshot (no-op for Time oracle, reads AMM for FutarchyTwap)
        pp.oracle_reader.record_end(ctx.remaining_accounts)?;

        // Compute oracle value
        let oracle_value = pp.oracle_reader.compute_value()?;

        // Calculate cumulative rewards based on oracle value
        let cumulative_rewards = pp.reward_function.calculate(oracle_value)?;

        // Calculate mint amount (only if rewards increased)
        let mint_amount = if cumulative_rewards > pp.total_rewards_paid_out {
            cumulative_rewards - pp.total_rewards_paid_out
        } else {
            0
        };

        // Mint to recipient if there's anything to mint
        if mint_amount > 0 {
            let create_key = pp.create_key;
            let bump = pp.bump;

            // Build PDA signer seeds for performance_package
            let seeds = &[PERFORMANCE_PACKAGE_SEED, create_key.as_ref(), &[bump]];
            let signer_seeds = &[&seeds[..]];

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.mint_governor_program.to_account_info(),
                MintTokens {
                    mint_governor: ctx.accounts.mint_governor.to_account_info(),
                    mint_authority: ctx.accounts.mint_authority.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    destination_ata: ctx.accounts.recipient_ata.to_account_info(),
                    authorized_minter: ctx.accounts.performance_package.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
                signer_seeds,
            );

            mint_tokens(
                cpi_ctx,
                MintTokensArgs {
                    amount: mint_amount,
                },
            )?;
        }

        // Re-borrow pp mutably after CPI
        let pp = &mut ctx.accounts.performance_package;

        // Update total_rewards_paid_out
        if cumulative_rewards > pp.total_rewards_paid_out {
            pp.total_rewards_paid_out = cumulative_rewards;
        }

        // Reset oracle state for next cycle
        pp.oracle_reader.reset();

        // Transition back to Locked status
        pp.status = PackageStatus::Locked;

        // Increment sequence number
        pp.seq_num += 1;

        let clock = Clock::get()?;

        emit!(UnlockCompletedEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
                performance_package_seq_num: pp.seq_num,
            },
            performance_package: pp.key(),
            oracle_value,
            recipient: pp.recipient,
            amount_minted: mint_amount,
            total_rewards_paid_out: pp.total_rewards_paid_out,
        });

        Ok(())
    }
}
