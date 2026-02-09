use anchor_lang::prelude::*;
use anchor_spl::token::spl_token::instruction::AuthorityType;
use anchor_spl::token::{self, Mint, SetAuthority, Token};

use crate::{CommonFields, MintAuthorityTransferredEvent, MintGovernor, MintGovernorError};

#[derive(Accounts)]
pub struct TransferAuthorityToGovernor<'info> {
    #[account(mut)]
    pub mint_governor: Account<'info, MintGovernor>,

    #[account(
        mut,
        address = mint_governor.mint @ MintGovernorError::MintMismatch
    )]
    pub mint: Account<'info, Mint>,

    pub current_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

impl TransferAuthorityToGovernor<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let mint_governor = &mut ctx.accounts.mint_governor;

        // CPI to set_authority to transfer mint authority to mint_governor PDA
        token::set_authority(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    current_authority: ctx.accounts.current_authority.to_account_info(),
                    account_or_mint: ctx.accounts.mint.to_account_info(),
                },
            ),
            AuthorityType::MintTokens,
            Some(mint_governor.key()),
        )?;

        // Increment seq_num
        mint_governor.seq_num += 1;

        // Emit event
        let clock = Clock::get()?;

        emit!(MintAuthorityTransferredEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
                mint_governor_seq_num: mint_governor.seq_num,
            },
            mint_governor: mint_governor.key(),
            mint: mint_governor.mint,
        });

        Ok(())
    }
}
