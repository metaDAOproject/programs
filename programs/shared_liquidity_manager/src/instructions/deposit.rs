use anchor_lang::{accounts::interface_account::InterfaceAccount, prelude::*};
use anchor_spl::{
    token::Token,
    token_interface::{Mint, Token2022, TokenAccount, TransferChecked},
    token_interface::transfer_checked,
};

use crate::state::{SharedLiquidityPool, LiquidityPosition};
use raydium_cpmm_cpi::states::PoolState;
use raydium_cpmm_cpi::cpi::accounts::Deposit as RaydiumDeposit;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositArgs {
    /// The amount of LP tokens to mint
    pub lp_token_amount: u64,
    /// The maximum amount of token 0 to deposit
    pub maximum_token_0_amount: u64,
    /// The maximum amount of token 1 to deposit
    pub maximum_token_1_amount: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        has_one = spot_pool_state,
        has_one = lp_token_vault,
    )]
    pub pool: Account<'info, SharedLiquidityPool>,
    
    #[account(mut)]
    pub spot_pool_state: AccountLoader<'info, PoolState>,
    
    /// The user's token accounts for the pool tokens
    #[account(
        mut,
        token::mint = token_0_vault.mint,
        constraint = user_token_a.to_account_info().owner == &token_program.key()
    )]
    pub user_token_a: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = token_1_vault.mint,
        constraint = user_token_b.to_account_info().owner == &token_program.key()
    )]
    pub user_token_b: Box<InterfaceAccount<'info, TokenAccount>>,
    
    /// The pool's token accounts
    #[account(
        mut,
        constraint = token_0_vault.key() == spot_pool_state.load()?.token_0_vault
    )]
    pub token_0_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = token_1_vault.key() == spot_pool_state.load()?.token_1_vault
    )]
    pub token_1_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    
    /// The vault mints
    #[account(
        address = token_0_vault.mint
    )]
    pub vault_0_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        address = token_1_vault.mint
    )]
    pub vault_1_mint: Box<InterfaceAccount<'info, Mint>>,
    
    /// The LP token mint and destination
    #[account(
        mut,
        address = spot_pool_state.load()?.lp_mint
    )]
    pub lp_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut)]
    pub lp_token_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = lp_mint,
        associated_token::authority = user,
    )]
    pub user_lp_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    
    /// The user's liquidity position
    #[account(
        init,
        payer = user,
        space = 8 + std::mem::size_of::<LiquidityPosition>(),
        seeds = [b"position", pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, LiquidityPosition>,
    
    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: pool vault and lp mint authority
    #[account(
        seeds = [
            raydium_cpmm_cpi::AUTH_SEED.as_bytes(),
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub raydium_authority: UncheckedAccount<'info>,


    
    pub token_program: Program<'info, Token>,
    pub token_program_2022: Program<'info, Token2022>,
    pub cp_swap_program: Program<'info, raydium_cpmm_cpi::program::RaydiumCpmm>,
    pub system_program: Program<'info, System>,
}

impl Deposit<'_> {
    pub fn handle(ctx: Context<Self>, args: DepositArgs) -> Result<()> {
        // Ensure the pool is not being used by an active proposal
        require!(!ctx.accounts.pool.is_active_proposal, CustomError::PoolInUse);
        
        // Call Raydium's deposit instruction
        let cpi_accounts = RaydiumDeposit {
            owner: ctx.accounts.user.to_account_info(),
            authority: ctx.accounts.raydium_authority.to_account_info(),
            pool_state: ctx.accounts.spot_pool_state.to_account_info(),
            owner_lp_token: ctx.accounts.user_lp_token_account.to_account_info(),
            token_0_account: ctx.accounts.user_token_a.to_account_info(),
            token_1_account: ctx.accounts.user_token_b.to_account_info(),
            token_0_vault: ctx.accounts.token_0_vault.to_account_info(),
            token_1_vault: ctx.accounts.token_1_vault.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            token_program_2022: ctx.accounts.token_program_2022.to_account_info(),
            vault_0_mint: ctx.accounts.vault_0_mint.to_account_info(),
            vault_1_mint: ctx.accounts.vault_1_mint.to_account_info(),
            lp_mint: ctx.accounts.lp_mint.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.cp_swap_program.to_account_info(),
            cpi_accounts,
        );
        
        raydium_cpmm_cpi::cpi::deposit(
            cpi_ctx,
            args.lp_token_amount,
            args.maximum_token_0_amount,
            args.maximum_token_1_amount,
        )?;

        // Transfer LP tokens from user to pool vault
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_lp_token_account.to_account_info(),
                mint: ctx.accounts.lp_mint.to_account_info(),
                to: ctx.accounts.lp_token_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        transfer_checked(
            transfer_ctx,
            args.lp_token_amount,
            ctx.accounts.lp_mint.decimals,
        )?;
        
        // Initialize the position
        ctx.accounts.position.set_inner(LiquidityPosition {
            owner: ctx.accounts.user.key(),
            pool: ctx.accounts.pool.key(),
            underlying_spot_lp_shares: args.lp_token_amount,
            bump: ctx.bumps.position,
        });
        
        Ok(())
    }
}

#[error_code]
pub enum CustomError {
    #[msg("Pool is currently being used by an active proposal")]
    PoolInUse,
} 