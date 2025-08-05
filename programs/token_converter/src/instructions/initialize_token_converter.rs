use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::TokenConverter;
use crate::error::TokenConverterError;

pub const CONVERSION_RATIO_SCALE: u64 = 1_000_000_000_000; // 1e12

#[derive(Accounts)]
#[instruction(conversion_ratio: u64, nonce: u64)]
pub struct InitializeTokenConverter<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TokenConverter::INIT_SPACE,
        seeds = [
            b"token_converter",
            inbound_token_mint.key().as_ref(),
            outbound_token_mint.key().as_ref(),
            authority.key().as_ref(),
            &nonce.to_le_bytes()
        ],
        bump
    )]
    pub token_converter: Account<'info, TokenConverter>,
    
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = inbound_token_mint,
        associated_token::authority = token_converter,
    )]
    pub inbound_token_vault: Box<Account<'info, TokenAccount>>,
    
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = outbound_token_mint,
        associated_token::authority = token_converter,
    )]
    pub outbound_token_vault: Box<Account<'info, TokenAccount>>,
    
    pub inbound_token_mint: Box<Account<'info, Mint>>,
    pub outbound_token_mint: Box<Account<'info, Mint>>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn initialize_token_converter(
    ctx: Context<InitializeTokenConverter>,
    conversion_ratio: u64, // How many outbound tokens per inbound token, scaled by 1e12
    nonce: u64,
) -> Result<()> {
    let converter = &mut ctx.accounts.token_converter;
    let inbound_mint = &ctx.accounts.inbound_token_mint;
    let outbound_mint = &ctx.accounts.outbound_token_mint;
    
    // Check that inbound and outbound mints are different
    require_keys_neq!(
        inbound_mint.key(),
        outbound_mint.key(),
        TokenConverterError::SameMint
    );
    
    converter.set_inner(TokenConverter {
        authority: ctx.accounts.authority.key(),
        inbound_token_mint: inbound_mint.key(),
        outbound_token_mint: outbound_mint.key(),
        inbound_token_vault: ctx.accounts.inbound_token_vault.key(),
        outbound_token_vault: ctx.accounts.outbound_token_vault.key(),
        inbound_token_decimals: inbound_mint.decimals,
        outbound_token_decimals: outbound_mint.decimals,
        conversion_ratio,
        nonce,
        bump: ctx.bumps.token_converter,
    });
    
    Ok(())
}