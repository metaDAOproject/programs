use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::{CommonFields, MintGovernor, MintGovernorInitializedEvent, MINT_GOVERNOR_SEED};

#[derive(Accounts)]
pub struct InitializeMintGovernor<'info> {
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        space = 8 + MintGovernor::INIT_SPACE,
        seeds = [MINT_GOVERNOR_SEED, mint.key().as_ref(), create_key.key().as_ref()],
        bump
    )]
    pub mint_governor: Account<'info, MintGovernor>,

    pub create_key: Signer<'info>,

    /// CHECK: This is the future admin, no validation needed
    pub admin: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl InitializeMintGovernor<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        ctx.accounts.mint_governor.set_inner(MintGovernor {
            mint: ctx.accounts.mint.key(),
            admin: ctx.accounts.admin.key(),
            create_key: ctx.accounts.create_key.key(),
            seq_num: 0,
            bump: ctx.bumps.mint_governor,
        });

        let clock = Clock::get()?;
        let mint_governor = &ctx.accounts.mint_governor;

        emit!(MintGovernorInitializedEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
                mint_governor_seq_num: mint_governor.seq_num,
            },
            mint_governor: mint_governor.key(),
            mint: mint_governor.mint,
            admin: mint_governor.admin,
            create_key: mint_governor.create_key,
            pda_bump: mint_governor.bump,
        });

        Ok(())
    }
}
