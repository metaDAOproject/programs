use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint, Burn};
use anchor_spl::associated_token::AssociatedToken;
use raydium_cpmm_cpi::{
    cpi, 
    program::RaydiumCpmm,
    states::{PoolState, POOL_LP_MINT_SEED}
};
use autocrat::state::Dao;
use autocrat::program::Autocrat;
use crate::consts::{V4_LAUNCHPAD_PROGRAM, MIGRATOR_ADMIN_ADDRESS, TOKEN_MIGRATOR_PROGRAM};

use crate::error::RedeemError;

#[derive(Accounts)]
pub struct Redeem<'info> {
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
        seeds::program = V4_LAUNCHPAD_PROGRAM,
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
    
    // Mints - validated against DAO
    /// Base token mint (must match DAO )
    #[account(
        mut,
        constraint = base_mint.key() == dao.token_mint @ RedeemError::InvalidMint,
    )]
    pub base_mint: Box<Account<'info, Mint>>,
    
    /// Quote token mint (USDC - must match DAO )
    #[account(
        constraint = quote_mint.key() == dao.usdc_mint @ RedeemError::InvalidMint,
    )]
    pub quote_mint: Box<Account<'info, Mint>>,
    
    // Source accounts (treasury owns these)
    /// Treasury's LP token account
    #[account(
        mut,
        associated_token::authority = treasury,
        associated_token::mint = lp_mint,
        constraint = lp_account.amount > 0 @ RedeemError::NoLpTokens,
    )]
    pub lp_account: Box<Account<'info, TokenAccount>>,
    
    /// Treasury's base token account
    #[account(
        mut,
        associated_token::authority = treasury,
        associated_token::mint = base_mint,
    )]
    pub treasury_base_account: Box<Account<'info, TokenAccount>>,
    
    /// Treasury's USDC account
    #[account(
        mut,
        associated_token::authority = treasury,
        associated_token::mint = quote_mint,
    )]
    pub treasury_quote_account: Box<Account<'info, TokenAccount>>,
    
    // Pool vault accounts
    /// Raydium pool's base token vault
    #[account(
        mut,
        associated_token::authority = pool_authority,
        associated_token::mint = base_mint,
    )]
    pub pool_base_vault: Box<Account<'info, TokenAccount>>,
    
    /// Raydium pool's quote token vault
    #[account(
        mut,
        associated_token::authority = pool_authority,
        associated_token::mint = quote_mint,
    )]
    pub pool_quote_vault: Box<Account<'info, TokenAccount>>,
    
    #[account(
        seeds = [
            b"vault",
            MIGRATOR_ADMIN_ADDRESS.as_ref(),
            base_mint.key().as_ref(),
            quote_mint.key().as_ref(),
        ],
        bump,
        seeds::program = TOKEN_MIGRATOR_PROGRAM,
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

impl Redeem<'_> {
    pub fn validate(&self) -> Result<()> {
        // Load the pool state to access its fields
        let pool = self.pool_state.load()?;
        
        // Validate pool configuration
        require_keys_eq!(
            pool.lp_mint,
            self.lp_mint.key(),
            RedeemError::InvalidPoolConfigurationLpMint
        );
        
        // Check pool status - ensure withdrawals are enabled
        require!(
            pool.status & 0b10 == 0,
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

        let (token_0_account, token_1_account, token_0_vault, token_1_vault, vault_0_mint, vault_1_mint) = 
            if ctx.accounts.base_mint.key() < ctx.accounts.quote_mint.key() {
                (
                    ctx.accounts.treasury_base_account.to_account_info(),
                    ctx.accounts.treasury_quote_account.to_account_info(),
                    ctx.accounts.pool_base_vault.to_account_info(),
                    ctx.accounts.pool_quote_vault.to_account_info(),
                    ctx.accounts.base_mint.to_account_info(),
                    ctx.accounts.quote_mint.to_account_info(),
                )
            } else {
                (
                    ctx.accounts.treasury_quote_account.to_account_info(),
                    ctx.accounts.treasury_base_account.to_account_info(),
                    ctx.accounts.pool_quote_vault.to_account_info(),
                    ctx.accounts.pool_base_vault.to_account_info(),
                    ctx.accounts.quote_mint.to_account_info(),
                    ctx.accounts.base_mint.to_account_info(),
                )
            };
        
        // Build the CPI context for Raydium withdraw
        let cpi_accounts = cpi::accounts::Withdraw {
            owner: ctx.accounts.treasury.to_account_info(),
            authority: ctx.accounts.pool_authority.to_account_info(),
            pool_state: ctx.accounts.pool_state.to_account_info(),
            owner_lp_token: ctx.accounts.lp_account.to_account_info(),
            token_0_account,
            token_1_account,
            token_0_vault,
            token_1_vault,
            token_program: ctx.accounts.token_program.to_account_info(),
            token_program_2022: ctx.accounts.token_program_2022.to_account_info(),
            vault_0_mint,
            vault_1_mint,
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
        
        raydium_cpmm_cpi::cpi::withdraw(
            cpi_ctx,
            lp_amount,
            min_base_amount,
            min_quote_amount,
        )?;

        // Reload accounts after CPI to get updated balances
        ctx.accounts.treasury_base_account.reload()?;
        ctx.accounts.treasury_quote_account.reload()?;

        // Step 2: Burn base tokens
        let base_balance = ctx.accounts.treasury_base_account.amount;
        if base_balance > 0 {
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.base_mint.to_account_info(),
                        from: ctx.accounts.treasury_base_account.to_account_info(),
                        authority: ctx.accounts.treasury.to_account_info(),
                    },
                    signer_seeds,
                ),
                base_balance,
            )?;
        }

        // Step 3: Transfer USDC to migrator vault
        let quote_balance = ctx.accounts.treasury_quote_account.amount;
        if quote_balance > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.treasury_quote_account.to_account_info(),
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