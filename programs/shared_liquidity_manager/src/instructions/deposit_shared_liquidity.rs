use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount, TransferChecked},
    token_interface::Token2022,
};

use crate::error::SharedLiquidityManagerError;
use crate::state::{LiquidityPosition, SharedLiquidityPool};
use raydium_cpmm_cpi::cpi::accounts::Deposit as RaydiumDeposit;
use raydium_cpmm_cpi::states::PoolState as RaydiumPoolState;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositSharedLiquidityParams {
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
        has_one = active_spot_pool,
        has_one = sl_pool_spot_lp_vault,
        has_one = base_mint,
        has_one = quote_mint,
    )]
    pub sl_pool: Account<'info, SharedLiquidityPool>,

    #[account(mut)]
    pub active_spot_pool: AccountLoader<'info, RaydiumPoolState>,

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
        init_if_needed,
        payer = payer,
        associated_token::mint = spot_pool_lp_mint,
        associated_token::authority = user,
    )]
    pub user_lp_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + std::mem::size_of::<LiquidityPosition>(),
        seeds = [b"sl_pool_position", sl_pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_sl_pool_position: Account<'info, LiquidityPosition>,

    pub user: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: pool vault and lp mint authority
    #[account(
        seeds = [
            raydium_cpmm_cpi::AUTH_SEED.as_bytes(),
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub raydium_authority: UncheckedAccount<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub token_program_2022: Program<'info, Token2022>,
    pub cp_swap_program: Program<'info, raydium_cpmm_cpi::program::RaydiumCpmm>,
    pub system_program: Program<'info, System>,
}

impl DepositSharedLiquidity<'_> {
    pub fn validate(&self) -> Result<()> {
        // Ensure the pool is not being used by an active proposal
        require!(
            self.sl_pool.active_proposal.is_none(),
            SharedLiquidityManagerError::PoolInUse
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: DepositSharedLiquidityParams) -> Result<()> {
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
                params.max_base_token_amount,
                params.max_quote_token_amount,
            )
        } else {
            (
                ctx.accounts.user_quote_token_account.to_account_info(),
                ctx.accounts.user_base_token_account.to_account_info(),
                ctx.accounts.spot_pool_quote_vault.to_account_info(),
                ctx.accounts.spot_pool_base_vault.to_account_info(),
                ctx.accounts.quote_mint.to_account_info(),
                ctx.accounts.base_mint.to_account_info(),
                params.max_quote_token_amount,
                params.max_base_token_amount,
            )
        };

        raydium_cpmm_cpi::cpi::deposit(
            CpiContext::new(
                ctx.accounts.cp_swap_program.to_account_info(),
                RaydiumDeposit {
                    owner: ctx.accounts.user.to_account_info(),
                    authority: ctx.accounts.raydium_authority.to_account_info(),
                    pool_state: ctx.accounts.active_spot_pool.to_account_info(),
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
            params.lp_token_amount,
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
            params.lp_token_amount,
            ctx.accounts.spot_pool_lp_mint.decimals,
        )?;

        // Update / initialize the position
        let position = &mut ctx.accounts.user_sl_pool_position;
        position.owner = ctx.accounts.user.key();
        position.pool = ctx.accounts.sl_pool.key();
        position.underlying_spot_lp_shares += params.lp_token_amount;
        position.bump = ctx.bumps.user_sl_pool_position;

        Ok(())
    }
}

#[cfg(test)]
mod deposit_tests {
    use super::*;
    use crate::state::SharedLiquidityPool;

    fn create_mock_sl_pool(active_proposal: Option<Pubkey>) -> SharedLiquidityPool {
        SharedLiquidityPool {
            pda_bump: 0,
            dao: Pubkey::default(),
            base_mint: Pubkey::default(),
            quote_mint: Pubkey::default(),
            sl_pool_signer: Pubkey::default(),
            sl_pool_signer_bump: 0,
            sl_pool_base_vault: Pubkey::default(),
            sl_pool_quote_vault: Pubkey::default(),
            sl_pool_spot_lp_vault: Pubkey::default(),
            active_proposal,
            proposal_stake_rate_threshold_bps: 1000,
            seq_num: 0,
            active_spot_pool: Pubkey::default(),
            active_spot_pool_index: 0,
            is_base_token_0: true,
        }
    }

    #[test]
    pub fn test_validate_pool_not_in_use() {
        let sl_pool = create_mock_sl_pool(None);
        let mock_ctx = MockDepositContext { sl_pool };

        let result = mock_ctx.validate();
        assert!(result.is_ok());
    }

    #[test]
    pub fn test_validate_pool_in_use() {
        let sl_pool = create_mock_sl_pool(Some(Pubkey::new_unique()));
        let mock_ctx = MockDepositContext { sl_pool };

        let result = mock_ctx.validate();
        assert!(result.is_err());
        let error = result.unwrap_err();
        match error {
            anchor_lang::error::Error::AnchorError(anchor_error) => {
                assert_eq!(anchor_error.error_code_number, 6005); // PoolInUse error code
                assert_eq!(anchor_error.error_name, "PoolInUse");
            }
            _ => panic!("Expected AnchorError"),
        }
    }

    // Mock context struct for testing validation logic
    struct MockDepositContext {
        sl_pool: SharedLiquidityPool,
    }

    impl MockDepositContext {
        fn validate(&self) -> Result<()> {
            require!(
                self.sl_pool.active_proposal.is_none(),
                SharedLiquidityManagerError::PoolInUse
            );
            Ok(())
        }
    }
}
