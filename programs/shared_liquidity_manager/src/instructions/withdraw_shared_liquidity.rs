use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Mint, Token, TokenAccount},
    token_interface::Token2022,
};

use crate::state::{LiquidityPosition, SharedLiquidityPool};
use raydium_cpmm_cpi::cpi::accounts::Withdraw as RaydiumWithdraw;
use raydium_cpmm_cpi::states::PoolState as RaydiumPoolState;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct WithdrawSharedLiquidityParams {
    /// The amount of LP tokens to withdraw
    pub lp_token_amount: u64,
    /// The minimum amount of token0 to receive
    pub minimum_token_0_amount: u64,
    /// The minimum amount of token1 to receive
    pub minimum_token_1_amount: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct WithdrawSharedLiquidity<'info> {
    #[account(
        mut,
        has_one = spot_pool,
        has_one = sl_pool_spot_lp_vault,
        has_one = base_mint,
        has_one = quote_mint,
    )]
    pub sl_pool: Account<'info, SharedLiquidityPool>,

    #[account(mut)]
    pub spot_pool: AccountLoader<'info, RaydiumPoolState>,

    #[account(mut)]
    pub sl_pool_spot_lp_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = sl_pool.quote_mint,
        token::authority = user,
    )]
    pub user_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = sl_pool.base_mint,
        token::authority = user,
    )]
    pub user_base_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub spot_pool_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub spot_pool_quote_vault: Box<Account<'info, TokenAccount>>,

    pub base_mint: Box<Account<'info, Mint>>,
    pub quote_mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub spot_pool_lp_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = spot_pool_lp_mint,
        associated_token::authority = user,
    )]
    pub user_lp_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"sl_pool_position", sl_pool.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub user_sl_pool_position: Account<'info, LiquidityPosition>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: Receives SOL when position is closed
    pub fee_receiver: UncheckedAccount<'info>,

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
    /// CHECK: SPL Memo program
    #[account(address = spl_memo::id())]
    pub memo_program: UncheckedAccount<'info>,
}

impl WithdrawSharedLiquidity<'_> {
    pub fn validate(&self) -> Result<()> {
        let (token_0, token_1) = if self.sl_pool.is_base_token_0 {
            (self.base_mint.key(), self.quote_mint.key())
        } else {
            (self.quote_mint.key(), self.base_mint.key())
        };

        let spot_pool = self.spot_pool.load()?;

        require_eq!(token_0, spot_pool.token_0_mint);
        require_eq!(token_1, spot_pool.token_1_mint);

        // Ensure the pool is not being used by an active proposal
        require!(
            self.sl_pool.active_proposal.is_none(),
            CustomError::PoolInUse
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: WithdrawSharedLiquidityParams) -> Result<()> {
        // Validate the position belongs to the user and pool
        require!(
            ctx.accounts.user_sl_pool_position.owner == ctx.accounts.user.key(),
            CustomError::Unauthorized
        );
        require!(
            ctx.accounts.user_sl_pool_position.pool == ctx.accounts.sl_pool.key(),
            CustomError::InvalidPool
        );

        // Ensure user has enough LP shares to withdraw
        require!(
            ctx.accounts.user_sl_pool_position.underlying_spot_lp_shares >= params.lp_token_amount,
            CustomError::InsufficientLpShares
        );

        // Get initial token balances to calculate how much was withdrawn
        let initial_base_balance = ctx.accounts.user_base_token_account.amount;
        let initial_quote_balance = ctx.accounts.user_quote_token_account.amount;

        let (
            token_0_account,
            token_1_account,
            vault_0_mint,
            vault_1_mint,
            token_0_vault,
            token_1_vault,
        ) = if ctx.accounts.sl_pool.is_base_token_0 {
            (
                ctx.accounts.user_base_token_account.to_account_info(),
                ctx.accounts.user_quote_token_account.to_account_info(),
                ctx.accounts.base_mint.to_account_info(),
                ctx.accounts.quote_mint.to_account_info(),
                ctx.accounts.spot_pool_base_vault.to_account_info(),
                ctx.accounts.spot_pool_quote_vault.to_account_info(),
            )
        } else {
            (
                ctx.accounts.user_quote_token_account.to_account_info(),
                ctx.accounts.user_base_token_account.to_account_info(),
                ctx.accounts.quote_mint.to_account_info(),
                ctx.accounts.base_mint.to_account_info(),
                ctx.accounts.spot_pool_quote_vault.to_account_info(),
                ctx.accounts.spot_pool_base_vault.to_account_info(),
            )
        };

        // Generate PDA seeds for signing
        let seeds = &[
            b"sl_pool".as_ref(),
            ctx.accounts.sl_pool.dao.as_ref(),
            ctx.accounts.sl_pool.spot_pool.as_ref(),
            &[ctx.accounts.sl_pool.pda_bump],
        ];
        let signer = &[&seeds[..]];

        // Withdraw from Raydium
        raydium_cpmm_cpi::cpi::withdraw(
            CpiContext::new_with_signer(
                ctx.accounts.cp_swap_program.to_account_info(),
                RaydiumWithdraw {
                    owner: ctx.accounts.sl_pool.to_account_info(),
                    authority: ctx.accounts.raydium_authority.to_account_info(),
                    pool_state: ctx.accounts.spot_pool.to_account_info(),
                    lp_mint: ctx.accounts.spot_pool_lp_mint.to_account_info(),
                    memo_program: ctx.accounts.memo_program.to_account_info(),
                    owner_lp_token: ctx.accounts.sl_pool_spot_lp_vault.to_account_info(),
                    token_0_account,
                    token_1_account,
                    vault_0_mint,
                    vault_1_mint,
                    token_0_vault,
                    token_1_vault,
                    token_program: ctx.accounts.token_program.to_account_info(),
                    token_program_2022: ctx.accounts.token_program_2022.to_account_info(),
                },
                signer,
            ),
            params.lp_token_amount,
            params.minimum_token_0_amount,
            params.minimum_token_1_amount,
        )?;

        // Reload accounts to get updated balances
        ctx.accounts.user_base_token_account.reload()?;
        ctx.accounts.user_quote_token_account.reload()?;

        // Calculate how many tokens the user received
        let base_received = ctx.accounts.user_base_token_account.amount - initial_base_balance;
        let quote_received = ctx.accounts.user_quote_token_account.amount - initial_quote_balance;

        // Verify minimum amounts were received
        require!(
            base_received >= params.minimum_token_0_amount || base_received >= params.minimum_token_1_amount,
            CustomError::SlippageExceeded
        );
        require!(
            quote_received >= params.minimum_token_0_amount || quote_received >= params.minimum_token_1_amount,
            CustomError::SlippageExceeded
        );

        // Update the user's position
        ctx.accounts.user_sl_pool_position.underlying_spot_lp_shares -= params.lp_token_amount;

        // If user has no more shares, close the position and send SOL to fee_receiver
        if ctx.accounts.user_sl_pool_position.underlying_spot_lp_shares == 0 {
            ctx.accounts.user_sl_pool_position.close(ctx.accounts.fee_receiver.to_account_info())?;
        }

        Ok(())
    }
}

#[error_code]
pub enum CustomError {
    #[msg("Pool is currently being used by an active proposal")]
    PoolInUse,
    #[msg("User does not have enough LP shares to withdraw")]
    InsufficientLpShares,
    #[msg("Unauthorized access to position")]
    Unauthorized,
    #[msg("Invalid pool for this position")]
    InvalidPool,
    #[msg("Slippage exceeded minimum token amounts")]
    SlippageExceeded,
} 