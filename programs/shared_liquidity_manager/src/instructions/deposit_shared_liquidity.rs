use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Mint, Token, TokenAccount, TransferChecked},
    token_interface::Token2022,
};

use crate::state::{LiquidityPosition, SharedLiquidityPool};
use raydium_cpmm_cpi::cpi::accounts::Deposit as RaydiumDeposit;
use raydium_cpmm_cpi::states::PoolState as RaydiumPoolState;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositSharedLiquidityArgs {
    /// The amount of LP tokens to mint
    pub lp_token_amount: u64,
    /// The maximum amount of quote tokens to deposit
    pub max_quote_token_amount: u64,
    /// The maximum amount of base tokens to deposit
    pub max_base_token_amount: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct DepositSharedLiquidity<'info> {
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
        init,
        payer = user,
        space = 8 + std::mem::size_of::<LiquidityPosition>(),
        seeds = [b"sl_pool_position", sl_pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_sl_pool_position: Account<'info, LiquidityPosition>,

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

impl DepositSharedLiquidity<'_> {
    pub fn validate(&self) -> Result<()> {
        let (token_0, token_1) = if self.sl_pool.is_base_token_0 {
            (self.base_mint.key(), self.quote_mint.key())
        } else {
            (self.quote_mint.key(), self.base_mint.key())
        };

        let spot_pool = self.spot_pool.load()?;

        require_eq!(token_0, spot_pool.token_0_mint);
        require_eq!(token_1, spot_pool.token_1_mint);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: DepositSharedLiquidityArgs) -> Result<()> {
        // Ensure the pool is not being used by an active proposal
        require!(
            ctx.accounts.sl_pool.active_proposal.is_none(),
            CustomError::PoolInUse
        );

        // let (token_0_account, token_1_account, maximum_token_0_amount, maximum_token_1_amount) = if ctx.accounts.sl_pool.is_base_token_0 {
        //     (ctx.accounts.user_base_token_account.to_account_info(), ctx.accounts.user_quote_token_account.to_account_info(), args.maximum_base_token_amount, args.maximum_quote_token_amount)
        // } else {
        //     (ctx.accounts.user_quote_token_account.to_account_info(), ctx.accounts.user_base_token_account.to_account_info(), args.maximum_quote_token_amount, args.maximum_base_token_amount)
        // };

        let (
            token_0_account,
            token_1_account,
            token_0_vault,
            token_1_vault,
            vault_0_mint,
            vault_1_mint,
            maximum_token_0_amount,
            maximum_token_1_amount,
        ) = if ctx.accounts.sl_pool.is_base_token_0 {
            (
                ctx.accounts.user_base_token_account.to_account_info(),
                ctx.accounts.user_quote_token_account.to_account_info(),
                ctx.accounts.spot_pool_base_vault.to_account_info(),
                ctx.accounts.spot_pool_quote_vault.to_account_info(),
                ctx.accounts.base_mint.to_account_info(),
                ctx.accounts.quote_mint.to_account_info(),
                args.max_base_token_amount,
                args.max_quote_token_amount,
            )
        } else {
            (
                ctx.accounts.user_quote_token_account.to_account_info(),
                ctx.accounts.user_base_token_account.to_account_info(),
                ctx.accounts.spot_pool_quote_vault.to_account_info(),
                ctx.accounts.spot_pool_base_vault.to_account_info(),
                ctx.accounts.quote_mint.to_account_info(),
                ctx.accounts.base_mint.to_account_info(),
                args.max_quote_token_amount,
                args.max_base_token_amount,
            )
        };

        raydium_cpmm_cpi::cpi::deposit(
            CpiContext::new(
                ctx.accounts.cp_swap_program.to_account_info(),
                RaydiumDeposit {
                    owner: ctx.accounts.user.to_account_info(),
                    authority: ctx.accounts.raydium_authority.to_account_info(),
                    pool_state: ctx.accounts.spot_pool.to_account_info(),
                    owner_lp_token: ctx.accounts.user_lp_token_account.to_account_info(),
                    token_0_account,
                    token_1_account,
                    token_0_vault,
                    token_1_vault,
                    token_program: ctx.accounts.token_program.to_account_info(),
                    token_program_2022: ctx.accounts.token_program_2022.to_account_info(),
                    vault_0_mint,
                    vault_1_mint,
                    lp_mint: ctx.accounts.spot_pool_lp_mint.to_account_info(),
                },
            ),
            args.lp_token_amount,
            maximum_token_0_amount,
            maximum_token_1_amount,
        )?;

        // Transfer LP tokens from user to pool vault
        anchor_spl::token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.user_lp_token_account.to_account_info(),
                    mint: ctx.accounts.spot_pool_lp_mint.to_account_info(),
                    to: ctx.accounts.sl_pool_spot_lp_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            args.lp_token_amount,
            ctx.accounts.spot_pool_lp_mint.decimals,
        )?;

        // Initialize the position
        ctx.accounts.user_sl_pool_position.set_inner(LiquidityPosition {
            owner: ctx.accounts.user.key(),
            pool: ctx.accounts.sl_pool.key(),
            underlying_spot_lp_shares: args.lp_token_amount,
            bump: ctx.bumps.user_sl_pool_position,
        });

        Ok(())
    }
}

#[error_code]
pub enum CustomError {
    #[msg("Pool is currently being used by an active proposal")]
    PoolInUse,
}
