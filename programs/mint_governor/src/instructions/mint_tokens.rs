use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::{
    CommonFields, MintAuthority, MintGovernor, MintGovernorError, TokensMintedEvent,
    MINT_GOVERNOR_SEED,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MintTokensArgs {
    pub amount: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub mint_governor: Account<'info, MintGovernor>,

    #[account(
        mut,
        has_one = mint_governor
    )]
    pub mint_authority: Account<'info, MintAuthority>,

    #[account(
        mut,
        address = mint_governor.mint @ MintGovernorError::MintMismatch
    )]
    pub mint: Account<'info, Mint>,

    #[account(mut, has_one = mint)]
    pub destination_ata: Account<'info, TokenAccount>,

    #[account(address = mint_authority.authorized_minter @ MintGovernorError::UnauthorizedMinter)]
    pub authorized_minter: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

impl MintTokens<'_> {
    pub fn validate(&self, args: &MintTokensArgs) -> Result<()> {
        // Check mint limit if max_total is set
        if let Some(max_total) = self.mint_authority.max_total {
            require_gte!(
                max_total,
                self.mint_authority.total_minted + args.amount,
                MintGovernorError::MintLimitExceeded
            );
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: MintTokensArgs) -> Result<()> {
        let mint_governor = &mut ctx.accounts.mint_governor;
        let mint_authority = &mut ctx.accounts.mint_authority;

        // Build PDA signer seeds
        let mint_key = mint_governor.mint;
        let create_key = mint_governor.create_key;
        let bump = mint_governor.bump;
        let seeds = &[
            MINT_GOVERNOR_SEED,
            mint_key.as_ref(),
            create_key.as_ref(),
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];

        // CPI to mint_to with mint_governor PDA as authority
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination_ata.to_account_info(),
                    authority: mint_governor.to_account_info(),
                },
                signer_seeds,
            ),
            args.amount,
        )?;

        // Update total_minted
        mint_authority.total_minted += args.amount;

        // Increment seq_num
        mint_governor.seq_num += 1;

        // Emit event
        let clock = Clock::get()?;

        // Reload mint to get post-mint supply
        ctx.accounts.mint.reload()?;

        emit_cpi!(TokensMintedEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
                mint_governor_seq_num: mint_governor.seq_num,
            },
            mint_governor: mint_governor.key(),
            mint: mint_governor.mint,
            authorized_minter: ctx.accounts.authorized_minter.key(),
            destination_ata: ctx.accounts.destination_ata.key(),
            amount: args.amount,
            post_total_minted: mint_authority.total_minted,
            authority_max_total: mint_authority.max_total,
            post_mint_supply: ctx.accounts.mint.supply,
        });

        Ok(())
    }
}
