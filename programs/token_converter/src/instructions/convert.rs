use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Burn, Mint};
use crate::state::TokenConverter;
use crate::error::TokenConverterError;
use crate::events::SwapExecuted;
use crate::instructions::initialize_token_converter::CONVERSION_RATIO_SCALE;

#[derive(Accounts)]
pub struct Convert<'info> {
    #[account(
        mut,
        seeds = [
            b"token_converter",
            token_converter.inbound_token_mint.as_ref(),
            token_converter.outbound_token_mint.as_ref(),
            token_converter.authority.as_ref(),
            &token_converter.nonce.to_le_bytes()
        ],
        bump = token_converter.bump
    )]
    pub token_converter: Box<Account<'info, TokenConverter>>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        associated_token::mint = inbound_token_mint,
        associated_token::authority = authority
    )]
    pub from: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = outbound_token_mint,
        associated_token::authority = authority
    )]
    pub to: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = inbound_token_vault.key() == token_converter.inbound_token_vault @ TokenConverterError::InvalidConverterInboundTokenAccount
    )]
    pub inbound_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = outbound_token_vault.key() == token_converter.outbound_token_vault @ TokenConverterError::InvalidConverterOutboundTokenAccount
    )]
    pub outbound_token_vault: Box<Account<'info, TokenAccount>>,

    pub inbound_token_mint: Box<Account<'info, Mint>>,
    pub outbound_token_mint: Box<Account<'info, Mint>>,
    
    pub token_program: Program<'info, Token>,
}

pub fn convert(ctx: Context<Convert>, amount: u64) -> Result<()> {
    let converter = &ctx.accounts.token_converter;
    
    // Validate that amount is greater than 0
    require_gte!(amount, 1, TokenConverterError::InvalidAmount);
    
    // Validate that user has sufficient balance
    require_gte!(
        ctx.accounts.from.amount, 
        amount,
        TokenConverterError::InsufficientBalance
    );
    
    // Calculate amount to transfer using scaled conversion ratio
    // First multiply by conversion ratio (which is scaled by 1e12)
    let scaled_amount = (amount as u128)
        .checked_mul(converter.conversion_ratio as u128)
        .ok_or(TokenConverterError::Overflow)?;
    
    // Then divide by the scale factor to get the actual amount
    let amount_to_transfer = scaled_amount
        .checked_div(CONVERSION_RATIO_SCALE as u128)
        .ok_or(TokenConverterError::Overflow)? as u64;
    
    // Validate that converter has sufficient outbound tokens
    require_gte!(
        ctx.accounts.outbound_token_vault.amount,
        amount_to_transfer, 
        TokenConverterError::InsufficientConverterBalance
    );
    
    // Handle inbound token (burn or transfer)
    if converter.burn_inbound_token {
        // Burn the inbound tokens from user's account
        let burn_cpi_accounts = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.inbound_token_mint.to_account_info(),
                from: ctx.accounts.from.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            }
        );
        token::burn(burn_cpi_accounts, amount)?;
    } else {
        // Transfer the inbound tokens from user's account to converter's vault
        let transfer_in_cpi_accounts = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.from.to_account_info(),
                to: ctx.accounts.inbound_token_vault.to_account_info(),   
                authority: ctx.accounts.authority.to_account_info(),
            }
        );
        token::transfer(transfer_in_cpi_accounts, amount)?;
    }

    // Transfer outbound tokens from converter's vault to user's account
    let authority_seeds = &[
        b"token_converter",
        converter.inbound_token_mint.as_ref(),
        converter.outbound_token_mint.as_ref(),
        &[converter.bump],
    ];
    let signer = &[&authority_seeds[..]];
    
    let transfer_out_cpi_accounts = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.outbound_token_vault.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.token_converter.to_account_info(),
        },
        signer
    );
    
    token::transfer(transfer_out_cpi_accounts, amount_to_transfer)?;
    
    // Emit swap event
    emit!(SwapExecuted {
        user: ctx.accounts.authority.key(),
        token_converter: ctx.accounts.token_converter.key(),
        inbound_token_mint: converter.inbound_token_mint,
        outbound_token_mint: converter.outbound_token_mint,
        inbound_amount: amount,
        outbound_amount: amount_to_transfer,
        burned: converter.burn_inbound_token,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}