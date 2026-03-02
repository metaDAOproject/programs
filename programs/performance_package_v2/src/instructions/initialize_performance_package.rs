use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use mint_governor::state::{MintAuthority, MintGovernor};

use crate::{
    CommonFields, OracleReader, PackageStatus, PerformancePackage, PerformancePackageCreatedEvent,
    PerformancePackageError, RewardFunction, PERFORMANCE_PACKAGE_SEED,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializePerformancePackageArgs {
    pub oracle_reader: OracleReader,
    pub reward_function: RewardFunction,
    pub min_unlock_timestamp: i64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct InitializePerformancePackage<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + PerformancePackage::INIT_SPACE,
        seeds = [PERFORMANCE_PACKAGE_SEED, create_key.key().as_ref()],
        bump
    )]
    pub performance_package: Account<'info, PerformancePackage>,

    pub mint: Account<'info, Mint>,

    #[account(
        has_one = mint @ PerformancePackageError::InvalidMintGovernor
    )]
    pub mint_governor: Account<'info, MintGovernor>,

    #[account(
        has_one = mint_governor @ PerformancePackageError::InvalidMintAuthority,
        constraint = mint_authority.authorized_minter == performance_package.key() @ PerformancePackageError::InvalidMintAuthority
    )]
    pub mint_authority: Account<'info, MintAuthority>,

    pub create_key: Signer<'info>,

    /// CHECK: This is the authority address, no validation needed
    pub authority: UncheckedAccount<'info>,

    /// CHECK: This is the recipient address, no validation needed
    pub recipient: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl InitializePerformancePackage<'_> {
    pub fn validate(&self, args: &InitializePerformancePackageArgs) -> Result<()> {
        args.oracle_reader.validate()?;
        args.reward_function.validate()?;
        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: InitializePerformancePackageArgs) -> Result<()> {
        ctx.accounts
            .performance_package
            .set_inner(PerformancePackage {
                mint: ctx.accounts.mint.key(),
                mint_governor: ctx.accounts.mint_governor.key(),
                mint_authority: ctx.accounts.mint_authority.key(),
                authority: ctx.accounts.authority.key(),
                recipient: ctx.accounts.recipient.key(),
                oracle_reader: args.oracle_reader,
                reward_function: args.reward_function,
                status: PackageStatus::Locked,
                min_unlock_timestamp: args.min_unlock_timestamp,
                total_rewards_paid_out: 0,
                seq_num: 0,
                create_key: ctx.accounts.create_key.key(),
                bump: ctx.bumps.performance_package,
            });

        let clock = Clock::get()?;
        let pp = &ctx.accounts.performance_package;

        emit_cpi!(PerformancePackageCreatedEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
                performance_package_seq_num: pp.seq_num,
            },
            performance_package: pp.key(),
            mint: pp.mint,
            mint_governor: pp.mint_governor,
            authority: pp.authority,
            recipient: pp.recipient,
            create_key: pp.create_key,
            pda_bump: pp.bump,
        });

        Ok(())
    }
}
