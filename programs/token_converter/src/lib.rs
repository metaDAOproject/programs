use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Burn, Mint};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("tknMiQZDHrrJe4VDESf3cJorj1jWCfCYK2g4d7nqjT1");

#[program]
pub mod token_converter {
    use super::*;

    pub fn initialize_token_converter_config(
        ctx: Context<InitializeTokenConverterConfig>,
        max_inbound_token_amount: u64,
        max_outbound_token_amount: u64,
        burn_inbound_token: bool,
    ) -> Result<()> {
        let config = &mut ctx.accounts.token_converter_config;
        let inbound_mint = &ctx.accounts.inbound_token_mint;
        let outbound_mint = &ctx.accounts.outbound_token_mint;
        
        config.authority = ctx.accounts.authority.key();
        config.inbound_token_mint = inbound_mint.key();
        config.outbound_token_mint = outbound_mint.key();
        config.inbound_token_decimals = inbound_mint.decimals;
        config.outbound_token_decimals = outbound_mint.decimals;
        config.max_inbound_token_amount = max_inbound_token_amount;
        config.max_outbound_token_amount = max_outbound_token_amount;
        config.burn_inbound_token = burn_inbound_token;
        config.seq_num = 0;
        config.bump = ctx.bumps.token_converter_config;
        
        Ok(())
    }

    pub fn initialize_token_converter(
        ctx: Context<InitializeTokenConverter>,
    ) -> Result<()> {
        let converter = &mut ctx.accounts.token_converter;
        let config = &ctx.accounts.token_converter_config;
        
        converter.seq_num = 0;
        converter.token_converter_config = config.key();
        converter.inbound_token_vault = ctx.accounts.inbound_token_vault.key();
        converter.outbound_token_vault = ctx.accounts.outbound_token_vault.key();
        converter.inbound_token_amount = 0;
        converter.outbound_token_amount = 0;
        converter.max_inbound_token_amount = config.max_inbound_token_amount;
        converter.max_outbound_token_amount = config.max_outbound_token_amount;
        converter.burn_inbound_token = config.burn_inbound_token;
        converter.inbound_token_decimals = config.inbound_token_decimals;
        converter.outbound_token_decimals = config.outbound_token_decimals;
        converter.bump = ctx.bumps.token_converter;
        
        Ok(())
    }

    pub fn convert(ctx: Context<Convert>, amount: u64) -> Result<()> {
        let converter = &ctx.accounts.token_converter;
        let config = &ctx.accounts.token_converter_config;
        
        // Validate that amount is greater than 0
        require!(amount > 0, TokenConverterError::InvalidAmount);
        
        // Validate that user has sufficient balance
        require!(
            ctx.accounts.from.amount >= amount, 
            TokenConverterError::InsufficientBalance
        );
        
        // Calculate conversion ratio based on max amounts
        // This represents how many outbound tokens per inbound token
        let conversion_ratio = config.max_outbound_token_amount
            .checked_div(config.max_inbound_token_amount)
            .ok_or(TokenConverterError::Overflow)?;
        
        // Calculate amount to transfer
        // Apply conversion ratio to the original amount
        let amount_to_transfer = amount
            .checked_mul(conversion_ratio)
            .ok_or(TokenConverterError::Overflow)?;
        
        // Validate that converter has sufficient outbound tokens
        require!(
            ctx.accounts.outbound_token_vault.amount >= amount_to_transfer, 
            TokenConverterError::InsufficientConverterBalance
        );
        
        // Handle inbound token (burn or transfer)
        if config.burn_inbound_token {
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
            config.inbound_token_mint.as_ref(),
            config.outbound_token_mint.as_ref(),
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
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeTokenConverterConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TokenConverterConfig::INIT_SPACE,
        seeds = [
            b"token_converter_config",
            inbound_token_mint.key().as_ref(),
            outbound_token_mint.key().as_ref()
        ],
        bump
    )]
    pub token_converter_config: Account<'info, TokenConverterConfig>,
    
    pub inbound_token_mint: Account<'info, Mint>,
    pub outbound_token_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeTokenConverter<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TokenConverter::INIT_SPACE,
        seeds = [
            b"token_converter",
            token_converter_config.inbound_token_mint.as_ref(),
            token_converter_config.outbound_token_mint.as_ref()
        ],
        bump
    )]
    pub token_converter: Account<'info, TokenConverter>,
    
    pub token_converter_config: Account<'info, TokenConverterConfig>,
    
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = inbound_token_mint,
        associated_token::authority = token_converter,
    )]
    pub inbound_token_vault: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = outbound_token_mint,
        associated_token::authority = token_converter,
    )]
    pub outbound_token_vault: Account<'info, TokenAccount>,
    
    pub inbound_token_mint: Account<'info, Mint>,
    pub outbound_token_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct Convert<'info> {
    #[account(
        mut,
        seeds = [
            b"token_converter",
            token_converter_config.inbound_token_mint.as_ref(),
            token_converter_config.outbound_token_mint.as_ref()
        ],
        bump = token_converter.bump
    )]
    pub token_converter: Account<'info, TokenConverter>,
    
    pub token_converter_config: Account<'info, TokenConverterConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        constraint = from.mint == token_converter_config.inbound_token_mint @ TokenConverterError::InvalidInboundToken,
        constraint = from.owner == authority.key() @ TokenConverterError::InvalidAuthority
    )]
    pub from: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = to.mint == token_converter_config.outbound_token_mint @ TokenConverterError::InvalidOutboundToken,
        constraint = to.owner == authority.key() @ TokenConverterError::InvalidAuthority
    )]
    pub to: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = inbound_token_vault.key() == token_converter.inbound_token_vault @ TokenConverterError::InvalidConverterInboundTokenAccount
    )]
    pub inbound_token_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = outbound_token_vault.key() == token_converter.outbound_token_vault @ TokenConverterError::InvalidConverterOutboundTokenAccount
    )]
    pub outbound_token_vault: Account<'info, TokenAccount>,

    pub inbound_token_mint: Account<'info, Mint>,
    pub outbound_token_mint: Account<'info, Mint>,
    
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct TokenConverter {
    pub seq_num: u64,
    pub token_converter_config: Pubkey,
    pub inbound_token_vault: Pubkey,
    pub outbound_token_vault: Pubkey,
    pub inbound_token_amount: u64,
    pub outbound_token_amount: u64,
    pub max_inbound_token_amount: u64,
    pub max_outbound_token_amount: u64,
    pub burn_inbound_token: bool,
    pub inbound_token_decimals: u8,
    pub outbound_token_decimals: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TokenConverterConfig {
    pub authority: Pubkey,
    pub inbound_token_mint: Pubkey,
    pub outbound_token_mint: Pubkey,
    pub inbound_token_decimals: u8,
    pub outbound_token_decimals: u8,
    pub max_inbound_token_amount: u64,
    pub max_outbound_token_amount: u64,
    pub burn_inbound_token: bool,
    pub seq_num: u64,
    pub bump: u8,
}

#[error_code]
pub enum TokenConverterError {
    #[msg("Invalid amount - must be greater than 0")]
    InvalidAmount,
    #[msg("Invalid inbound token mint")]
    InvalidInboundToken,
    #[msg("Invalid outbound token mint")]
    InvalidOutboundToken,
    #[msg("Invalid converter inbound token account")]
    InvalidConverterInboundTokenAccount,
    #[msg("Invalid converter outbound token account")]
    InvalidConverterOutboundTokenAccount,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Insufficient converter balance")]
    InsufficientConverterBalance,
    #[msg("Converter not active")]
    ConverterNotActive,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Assertion failed")]
    AssertFailed,
}