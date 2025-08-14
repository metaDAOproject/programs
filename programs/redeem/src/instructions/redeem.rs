use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint, Burn};
use anchor_spl::associated_token::AssociatedToken;
use raydium_cpmm_cpi::{cpi, program::RaydiumCpmm, states::{PoolState, POOL_LP_MINT_SEED}};
use autocrat::state::Dao;
use autocrat::program::Autocrat;
use std::str::FromStr;

use crate::error::RedeemError;

#[derive(Accounts)]
pub struct UnwindAndMigrate<'info> {
    // DAO account from Autocrat with all configuration
    pub dao: Box<Account<'info, Dao>>,
    
    // Treasury PDA (derived from DAO)
    /// CHECK: DAO Treasury PDA that owns the LP tokens
    #[account(
        mut,
        seeds = [
            b"dao_treasury", 
            dao.key().as_ref(),
        ],
        seeds::program = autocrat_program,
        bump,
    )]
    pub treasury: UncheckedAccount<'info>,
    
    // Raydium pool accounts
    /// The Raydium CPMM pool state (zero-copy account)
    #[account(
        mut,
        seeds = [
            b"pool_state",
            dao.key().as_ref(),
        ],
        bump,
        seeds::program = Pubkey::from_str("AfJJJ5UqxhBKoE3grkKAZZsoXDE9kncbMKvqSHGsCNrE").unwrap(), // v4 launchpad
    )]
    pub pool_state: AccountLoader<'info, PoolState>,
    
    /// Raydium pool authority PDA
    /// CHECK: Validated by seed derivation
    #[account(
        seeds = [
            raydium_cpmm_cpi::AUTH_SEED.as_bytes(),
        ],
        bump = pool_state.load()?.auth_bump,
        seeds::program = cp_swap_program.key(),
    )]
    pub pool_authority: UncheckedAccount<'info>,
    
    /// LP token mint
    #[account(
        mut,
        seeds = [
            POOL_LP_MINT_SEED.as_bytes(),
            pool_state.key().as_ref(),
        ],
        seeds::program = cp_swap_program.key(),
        bump,
        constraint = lp_mint.key() == pool_state.load()?.lp_mint @ RedeemError::InvalidPoolConfiguration,
    )]
    pub lp_mint: Box<Account<'info, Mint>>,
    
    // Mints - validated against DAO and pool configuration
    /// Base token mint (must match DAO and pool configuration)
    #[account(
        mut,
        constraint = base_mint.key() == dao.base_mint @ RedeemError::InvalidMint,
        constraint = base_mint.key() == pool_state.load()?.token_0_mint @ RedeemError::InvalidPoolConfiguration,
    )]
    pub base_mint: Box<Account<'info, Mint>>,
    
    /// Quote token mint (USDC - must match DAO and pool configuration)
    #[account(
        constraint = quote_mint.key() == dao.quote_mint @ RedeemError::InvalidMint,
        constraint = quote_mint.key() == pool_state.load()?.token_1_mint @ RedeemError::InvalidPoolConfiguration,
    )]
    pub quote_mint: Box<Account<'info, Mint>>,
    
    // Source accounts (treasury owns these)
    /// Treasury's LP token account
    #[account(
        mut,
        constraint = lp_account.owner == treasury.key() @ RedeemError::InvalidAuthority,
        constraint = lp_account.mint == lp_mint.key() @ RedeemError::InvalidTokenAccount,
        constraint = lp_account.amount > 0 @ RedeemError::NoLpTokens,
    )]
    pub lp_account: Box<Account<'info, TokenAccount>>,
    
    /// Treasury's base token account
    #[account(
        mut,
        constraint = base_account.owner == treasury.key() @ RedeemError::InvalidAuthority,
        constraint = base_account.mint == base_mint.key() @ RedeemError::InvalidTokenAccount,
    )]
    pub base_account: Box<Account<'info, TokenAccount>>,
    
    /// Treasury's USDC account
    #[account(
        mut,
        constraint = quote_account.owner == treasury.key() @ RedeemError::InvalidAuthority,
        constraint = quote_account.mint == quote_mint.key() @ RedeemError::InvalidTokenAccount,
    )]
    pub quote_account: Box<Account<'info, TokenAccount>>,
    
    // Pool vault accounts
    /// Raydium pool's base token vault, vault 0
    #[account(
        mut,
        constraint = pool_base_vault.key() == pool_state.load()?.token_0_vault @ RedeemError::InvalidPoolVault,
        constraint = pool_base_vault.owner == pool_authority.key() @ RedeemError::InvalidPoolVault,
        constraint = pool_base_vault.mint == base_mint.key() @ RedeemError::InvalidPoolVault,
    )]
    pub pool_base_vault: Box<Account<'info, TokenAccount>>,
    
    /// Raydium pool's USDC vault, vault 1
    #[account(
        mut,
        constraint = pool_quote_vault.key() == pool_state.load()?.token_1_vault @ RedeemError::InvalidPoolVault,
        constraint = pool_quote_vault.owner == pool_authority.key() @ RedeemError::InvalidPoolVault,
        constraint = pool_quote_vault.mint == quote_mint.key() @ RedeemError::InvalidPoolVault,
    )]
    pub pool_quote_vault: Box<Account<'info, TokenAccount>>,
    
    #[account(
        mut,
        constraint = migrator_vault.mint == quote_mint.key() @ RedeemError::InvalidDestination,
    )]
    pub migrator_vault: Box<Account<'info, TokenAccount>>,
    
    // Programs
    pub token_program: Program<'info, Token>,
    pub autocrat_program: Program<'info, Autocrat>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub cp_swap_program: Program<'info, RaydiumCpmm>,
    
    /// Token Program 2022 for potential token-2022 tokens
    /// CHECK: Validated by Raydium during CPI
    pub token_program_2022: UncheckedAccount<'info>,
    
    /// Optional memo program for Raydium
    /// CHECK: Validated by Raydium during CPI
    pub memo_program: UncheckedAccount<'info>,
}

impl UnwindAndMigrate<'_> {
    pub fn validate(&self) -> Result<()> {
        // Load the pool state to access its fields
        let pool = self.pool_state.load()?;
        
        // Validate pool configuration
        require_keys_eq!(
            pool.token_0_mint, 
            self.dao.base_mint,
            RedeemError::InvalidPoolConfigurationToken0
        );
        require_keys_eq!(
            pool.token_1_mint,
            self.dao.quote_mint,
            RedeemError::InvalidPoolConfigurationToken1
        );
        require_keys_eq!(
            pool.lp_mint,
            self.lp_mint.key(),
            RedeemError::InvalidPoolConfigurationLpMint
        );
        
        // Check pool status - ensure withdrawals are enabled
        require!(
            pool.status & 2 == 0,
            RedeemError::WithdrawalsDisabled
        );
        
        Ok(())
    }

    pub fn handler(ctx: Context<Self>) -> Result<()> {
        // Step 1: Withdraw liquidity from Raydium CPMM using CPI
        let lp_amount = ctx.accounts.lp_account.amount;
        
        // Set minimum amounts to 0 - we don't care about slippage
        let min_base_amount = 0u64;
        let min_quote_amount = 0u64;
        
        // Store the DAO key to avoid temporary value error
        let dao_key = ctx.accounts.dao.key();
        
        // Derive the treasury PDA seeds for signing
        let treasury_seeds = &[
            b"dao_treasury".as_ref(),
            dao_key.as_ref(),
            &[ctx.bumps.treasury],
        ];
        let signer_seeds = &[&treasury_seeds[..]];
        
        // Build the CPI context for Raydium withdraw
        let cpi_accounts = cpi::accounts::Withdraw {
            owner: ctx.accounts.treasury.to_account_info(),
            authority: ctx.accounts.pool_authority.to_account_info(),
            pool_state: ctx.accounts.pool_state.to_account_info(),
            owner_lp_token: ctx.accounts.lp_account.to_account_info(),
            token_0_account: ctx.accounts.base_account.to_account_info(),
            token_1_account: ctx.accounts.quote_account.to_account_info(),
            token_0_vault: ctx.accounts.pool_base_vault.to_account_info(),
            token_1_vault: ctx.accounts.pool_quote_vault.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            token_program_2022: ctx.accounts.token_program_2022.to_account_info(),
            vault_0_mint: ctx.accounts.base_mint.to_account_info(),
            vault_1_mint: ctx.accounts.quote_mint.to_account_info(),
            lp_mint: ctx.accounts.lp_mint.to_account_info(),
            memo_program: ctx.accounts.memo_program.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.cp_swap_program.to_account_info();
        
        // Execute the withdraw with PDA signer
        let cpi_ctx = CpiContext::new_with_signer(
            cpi_program,
            cpi_accounts,
            signer_seeds,
        );
        
        cpi::withdraw(
            cpi_ctx,
            lp_amount,
            min_base_amount,
            min_quote_amount,
        )?;

        // Reload accounts after CPI to get updated balances
        ctx.accounts.base_account.reload()?;
        ctx.accounts.quote_account.reload()?;

        // Step 2: Burn base tokens
        let base_balance = ctx.accounts.base_account.amount;
        if base_balance > 0 {
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.base_mint.to_account_info(),
                        from: ctx.accounts.base_account.to_account_info(),
                        authority: ctx.accounts.treasury.to_account_info(),
                    },
                    signer_seeds,
                ),
                base_balance,
            )?;
        }

        // Step 3: Transfer USDC to migrator vault
        let quote_balance = ctx.accounts.quote_account.amount;
        if quote_balance > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.quote_account.to_account_info(),
                        to: ctx.accounts.migrator_vault.to_account_info(),
                        authority: ctx.accounts.treasury.to_account_info(),
                    },
                    signer_seeds,
                ),
                quote_balance,
            )?;
        }

        Ok(())
    }
}