use anchor_lang::prelude::*;

use crate::{
    CommonFields, MintAuthority, MintAuthorityAddedEvent, MintGovernor, MintGovernorError,
    MINT_AUTHORITY_SEED,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AddMintAuthorityArgs {
    pub max_total: Option<u64>,
}

#[event_cpi]
#[derive(Accounts)]
pub struct AddMintAuthority<'info> {
    #[account(mut)]
    pub mint_governor: Account<'info, MintGovernor>,

    #[account(
        init,
        payer = payer,
        space = 8 + MintAuthority::INIT_SPACE,
        seeds = [MINT_AUTHORITY_SEED, mint_governor.key().as_ref(), authorized_minter.key().as_ref()],
        bump
    )]
    pub mint_authority: Account<'info, MintAuthority>,

    #[account(address = mint_governor.admin @ MintGovernorError::UnauthorizedAdmin)]
    pub admin: Signer<'info>,

    /// CHECK: This is the address receiving minting rights, no validation needed
    pub authorized_minter: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl AddMintAuthority<'_> {
    pub fn validate(&self, _args: &AddMintAuthorityArgs) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: AddMintAuthorityArgs) -> Result<()> {
        let mint_governor = &mut ctx.accounts.mint_governor;
        let mint_authority = &mut ctx.accounts.mint_authority;

        mint_authority.set_inner(MintAuthority {
            mint_governor: mint_governor.key(),
            authorized_minter: ctx.accounts.authorized_minter.key(),
            max_total: args.max_total,
            total_minted: 0,
            bump: ctx.bumps.mint_authority,
        });

        mint_governor.seq_num += 1;

        let clock = Clock::get()?;

        emit_cpi!(MintAuthorityAddedEvent {
            common: CommonFields {
                slot: clock.slot,
                unix_timestamp: clock.unix_timestamp,
                mint_governor_seq_num: mint_governor.seq_num,
            },
            mint_governor: mint_governor.key(),
            mint_authority: ctx.accounts.mint_authority.key(),
            authorized_minter: ctx.accounts.authorized_minter.key(),
            max_total: args.max_total,
        });

        Ok(())
    }
}
