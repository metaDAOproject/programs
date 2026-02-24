use anchor_lang::prelude::*;
use anchor_spl::token::spl_token::instruction::AuthorityType;
use anchor_spl::token::{self, Mint, SetAuthority, Token};

use crate::{
    CommonFields, MintAuthorityReclaimedEvent, MintGovernor, MintGovernorError, MINT_GOVERNOR_SEED,
};

#[event_cpi]
#[derive(Accounts)]
pub struct ReclaimAuthority<'info> {
    #[account(mut)]
    pub mint_governor: Account<'info, MintGovernor>,

    #[account(
        mut,
        address = mint_governor.mint @ MintGovernorError::MintMismatch
    )]
    pub mint: Account<'info, Mint>,

    #[account(address = mint_governor.admin @ MintGovernorError::UnauthorizedAdmin)]
    pub admin: Signer<'info>,

    /// CHECK: This is the new authority address, no validation needed
    pub new_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

impl ReclaimAuthority<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        // NOTE: After reclaim, MintGovernor and MintAuthority accounts remain but become
        // non-functional. This is accepted behavior - no cleanup mechanism is provided.
        // Callers attempting mint_tokens after reclaim will fail at CPI.
        let mint_governor = &mut ctx.accounts.mint_governor;

        // Build PDA signer seeds
        let mint_key = mint_governor.mint;
        let create_key = mint_governor.create_key;
        let bump = mint_governor.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[
            MINT_GOVERNOR_SEED,
            mint_key.as_ref(),
            create_key.as_ref(),
            &[bump],
        ]];

        // CPI to set_authority to transfer mint authority to new_authority
        token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    current_authority: mint_governor.to_account_info(),
                    account_or_mint: ctx.accounts.mint.to_account_info(),
                },
                signer_seeds,
            ),
            AuthorityType::MintTokens,
            Some(ctx.accounts.new_authority.key()),
        )?;

        // Increment seq_num
        mint_governor.seq_num += 1;

        // Emit event
        let clock = Clock::get()?;

        emit_cpi!(MintAuthorityReclaimedEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
                mint_governor_seq_num: mint_governor.seq_num,
            },
            mint_governor: mint_governor.key(),
            mint: mint_governor.mint,
            new_authority: ctx.accounts.new_authority.key(),
        });

        Ok(())
    }
}
