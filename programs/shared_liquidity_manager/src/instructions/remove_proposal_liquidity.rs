use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

use raydium_cpmm_cpi::cpi::accounts::Deposit as RaydiumDeposit;

use crate::state::SharedLiquidityPool;

#[derive(Accounts)]
pub struct RaydiumAccounts2<'info> {
    #[account(mut)]
    pub spot_pool: AccountLoader<'info, raydium_cpmm_cpi::states::PoolState>,
    #[account(mut)]
    pub spot_pool_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub spot_pool_quote_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub lp_mint: Box<InterfaceAccount<'info, anchor_spl::token_interface::Mint>>,
    /// CHECK: Raydium authority PDA
    pub raydium_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, anchor_spl::token::Token>,
    pub token_program_2022: Program<'info, anchor_spl::token_interface::Token2022>,
    pub cp_swap_program: Program<'info, raydium_cpmm_cpi::program::RaydiumCpmm>,
    /// CHECK: SPL Memo program
    #[account(address = spl_memo::id())]
    pub memo_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ConditionalVaultAccounts2<'info> {
    #[account(mut)]
    pub question: Account<'info, conditional_vault::state::Question>,
    #[account(mut)]
    pub base_vault: Account<'info, conditional_vault::state::ConditionalVault>,
    #[account(mut)]
    pub quote_vault: Account<'info, conditional_vault::state::ConditionalVault>,
    #[account(mut, address = base_vault.underlying_token_account)]
    pub base_vault_underlying_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = quote_vault.underlying_token_account)]
    pub quote_vault_underlying_token_account: Box<Account<'info, TokenAccount>>,
    pub conditional_vault_program: Program<'info, conditional_vault::program::ConditionalVault>,
    #[account(mut)]
    pub pass_base_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub fail_base_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub pass_quote_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub fail_quote_mint: Box<Account<'info, Mint>>,
    #[account(mut, token::mint = pass_base_mint, token::authority = sl_pool)]
    pub sl_pool_pass_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = fail_base_mint, token::authority = sl_pool)]
    pub sl_pool_fail_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = pass_quote_mint, token::authority = sl_pool)]
    pub sl_pool_pass_quote_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = fail_quote_mint, token::authority = sl_pool)]
    pub sl_pool_fail_quote_vault: Box<Account<'info, TokenAccount>>,
    /// CHECK: verified by conditional_vault
    pub vault_event_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, anchor_spl::token::Token>,
    pub sl_pool: Account<'info, SharedLiquidityPool>,
}

#[derive(Accounts)]
pub struct AmmAccounts2<'info> {
    #[account(mut)]
    pub pass_amm: Account<'info, amm::state::Amm>,
    #[account(mut)]
    pub fail_amm: Account<'info, amm::state::Amm>,
    #[account(mut)]
    pub pass_lp_mint: Box<Account<'info, anchor_spl::token::Mint>>,
    #[account(mut)]
    pub fail_lp_mint: Box<Account<'info, anchor_spl::token::Mint>>,
    #[account(mut)]
    pub sl_pool_pass_lp_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub sl_pool_fail_lp_account: Box<Account<'info, anchor_spl::token::TokenAccount>>,
    #[account(mut)]
    pub pass_amm_vault_ata_base: Box<Account<'info, anchor_spl::token::TokenAccount>>,
    #[account(mut)]
    pub pass_amm_vault_ata_quote: Box<Account<'info, anchor_spl::token::TokenAccount>>,
    #[account(mut)]
    pub fail_amm_vault_ata_base: Box<Account<'info, anchor_spl::token::TokenAccount>>,
    #[account(mut)]
    pub fail_amm_vault_ata_quote: Box<Account<'info, anchor_spl::token::TokenAccount>>,
    #[account(mut)]
    pub proposal_pass_lp_vault: Box<Account<'info, anchor_spl::token::TokenAccount>>,
    #[account(mut)]
    pub proposal_fail_lp_vault: Box<Account<'info, anchor_spl::token::TokenAccount>>,
    pub amm_program: Program<'info, amm::program::Amm>,
    /// CHECK: verified by amm
    pub event_authority: UncheckedAccount<'info>,
}

#[event_cpi]
#[derive(Accounts)]
pub struct RemoveProposalLiquidity<'info> {
    // Shared liquidity pool state
    #[account(mut,
        has_one = sl_pool_base_vault,
        has_one = sl_pool_quote_vault,
        has_one = sl_pool_spot_lp_vault,
        has_one = base_mint,
        has_one = quote_mint,
        constraint = sl_pool.spot_pool == ray.spot_pool.key()
    )]
    pub sl_pool: Account<'info, SharedLiquidityPool>,
    pub proposal_remover: Signer<'info>,
    /// CHECK: initialized by autocrat
    #[account(mut)]
    pub proposal: UncheckedAccount<'info>,

    #[account(mut)]
    pub sl_pool_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub sl_pool_quote_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub sl_pool_spot_lp_vault: Box<Account<'info, TokenAccount>>,

    pub base_mint: Box<Account<'info, Mint>>,
    pub quote_mint: Box<Account<'info, Mint>>,

    // Raydium accounts
    pub ray: RaydiumAccounts2<'info>,

    // Conditional vault accounts
    pub cond: ConditionalVaultAccounts2<'info>,

    // AMM accounts
    pub ammm2: AmmAccounts2<'info>,

    // Autocrat accounts
    #[account(mut)]
    pub dao: Box<Account<'info, autocrat::state::Dao>>,
    pub autocrat_program: Program<'info, autocrat::program::Autocrat>,
    pub system_program: Program<'info, System>,
    /// CHECK: verified by autocrat
    pub autocrat_event_authority: UncheckedAccount<'info>,
}

impl RemoveProposalLiquidity<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        // Check that the proposal is finalized
        require!(
            ctx.accounts.cond.question.is_resolved(),
            ErrorCode::ProposalNotFinalized
        );

        // Get initial balances to track what we're putting back
        let initial_sl_pool_base_balance = ctx.accounts.sl_pool_base_vault.amount;
        let initial_sl_pool_quote_balance = ctx.accounts.sl_pool_quote_vault.amount;

        // Get the proposal outcome to determine which AMM to remove liquidity from
        let question = &ctx.accounts.cond.question;
        let payout_numerators = &question.payout_numerators;
        
        // Determine if the proposal passed (outcome 0) or failed (outcome 1)
        // payout_numerators[0] > payout_numerators[1] means outcome 0 (pass) won
        let proposal_passed = payout_numerators[0] > payout_numerators[1];
        
        let (amm_to_remove_from, lp_account_to_remove_from, base_vault_to_redeem, quote_vault_to_redeem) = if proposal_passed {
            (
                ctx.accounts.ammm2.pass_amm.to_account_info(),
                ctx.accounts.ammm2.sl_pool_pass_lp_account.to_account_info(),
                ctx.accounts.cond.sl_pool_pass_base_vault.to_account_info(),
                ctx.accounts.cond.sl_pool_pass_quote_vault.to_account_info(),
            )
        } else {
            (
                ctx.accounts.ammm2.fail_amm.to_account_info(),
                ctx.accounts.ammm2.sl_pool_fail_lp_account.to_account_info(),
                ctx.accounts.cond.sl_pool_fail_base_vault.to_account_info(),
                ctx.accounts.cond.sl_pool_fail_quote_vault.to_account_info(),
            )
        };

        // Get the LP token balance to remove
        let mut lp_balance_to_remove = ctx.accounts.ammm2.sl_pool_pass_lp_account.amount;
        if !proposal_passed {
            lp_balance_to_remove = ctx.accounts.ammm2.sl_pool_fail_lp_account.amount;
        }
        
        require!(lp_balance_to_remove > 0, ErrorCode::NoLpTokensToRemove);

        // Generate PDA seeds for signing
        let spot_pool_key = ctx.accounts.ray.spot_pool.key();
        let dao_key = ctx.accounts.dao.key();
        let seeds = &[
            b"sl_pool".as_ref(),
            dao_key.as_ref(),
            spot_pool_key.as_ref(),
            &[ctx.accounts.sl_pool.pda_bump],
        ];
        let signer = &[&seeds[..]];

        // Remove liquidity from the winning AMM
        amm::cpi::remove_liquidity(
            CpiContext::new_with_signer(
                ctx.accounts.ammm2.amm_program.to_account_info(),
                amm::cpi::accounts::AddOrRemoveLiquidity {
                    amm: amm_to_remove_from,
                    user: ctx.accounts.sl_pool.to_account_info(),
                    user_lp_account: lp_account_to_remove_from,
                    user_base_account: base_vault_to_redeem,
                    user_quote_account: quote_vault_to_redeem,
                    vault_ata_base: if proposal_passed {
                        ctx.accounts.ammm2.pass_amm_vault_ata_base.to_account_info()
                    } else {
                        ctx.accounts.ammm2.fail_amm_vault_ata_base.to_account_info()
                    },
                    vault_ata_quote: if proposal_passed {
                        ctx.accounts.ammm2.pass_amm_vault_ata_quote.to_account_info()
                    } else {
                        ctx.accounts.ammm2.fail_amm_vault_ata_quote.to_account_info()
                    },
                    event_authority: ctx.accounts.ammm2.event_authority.to_account_info(),
                    program: ctx.accounts.ammm2.amm_program.to_account_info(),
                    lp_mint: if proposal_passed {
                        ctx.accounts.ammm2.pass_lp_mint.to_account_info()
                    } else {
                        ctx.accounts.ammm2.fail_lp_mint.to_account_info()
                    },
                    token_program: ctx.accounts.ray.token_program.to_account_info(),
                },
                signer,
            ),
            amm::instructions::RemoveLiquidityArgs {
                lp_tokens_to_burn: lp_balance_to_remove,
                min_base_amount: 0,
                min_quote_amount: 0,
            }
        )?;

        // Reload accounts to get updated balances
        ctx.accounts.sl_pool_base_vault.reload()?;
        ctx.accounts.sl_pool_quote_vault.reload()?;

        // Calculate how many conditional tokens we got from removing liquidity
        let base_conditional_tokens = ctx.accounts.sl_pool_base_vault.amount - initial_sl_pool_base_balance;
        let quote_conditional_tokens = ctx.accounts.sl_pool_quote_vault.amount - initial_sl_pool_quote_balance;

        require!(base_conditional_tokens > 0, ErrorCode::NoTokensFromAmm);
        require!(quote_conditional_tokens > 0, ErrorCode::NoTokensFromAmm);

        // Redeem the conditional tokens back to underlying tokens
        // Redeem base tokens
        conditional_vault::cpi::redeem_tokens(
            CpiContext::new_with_signer(
                ctx.accounts.cond.conditional_vault_program.to_account_info(),
                conditional_vault::cpi::accounts::InteractWithVault {
                    question: ctx.accounts.cond.question.to_account_info(),
                    vault: ctx.accounts.cond.base_vault.to_account_info(),
                    vault_underlying_token_account: ctx.accounts.cond.base_vault_underlying_token_account.to_account_info(),
                    authority: ctx.accounts.sl_pool.to_account_info(),
                    user_underlying_token_account: ctx.accounts.sl_pool_base_vault.to_account_info(),
                    event_authority: ctx.accounts.cond.vault_event_authority.to_account_info(),
                    program: ctx.accounts.cond.conditional_vault_program.to_account_info(),
                    token_program: ctx.accounts.ray.token_program.to_account_info(),
                },
                signer,
            )
            .with_remaining_accounts(vec![
                ctx.accounts.cond.pass_base_mint.to_account_info(),
                ctx.accounts.cond.fail_base_mint.to_account_info(),
                ctx.accounts.cond.sl_pool_pass_base_vault.to_account_info(),
                ctx.accounts.cond.sl_pool_fail_base_vault.to_account_info(),
            ]),
        )?;

        // Redeem quote tokens
        conditional_vault::cpi::redeem_tokens(
            CpiContext::new_with_signer(
                ctx.accounts.cond.conditional_vault_program.to_account_info(),
                conditional_vault::cpi::accounts::InteractWithVault {
                    question: ctx.accounts.cond.question.to_account_info(),
                    vault: ctx.accounts.cond.quote_vault.to_account_info(),
                    vault_underlying_token_account: ctx.accounts.cond.quote_vault_underlying_token_account.to_account_info(),
                    authority: ctx.accounts.sl_pool.to_account_info(),
                    user_underlying_token_account: ctx.accounts.sl_pool_quote_vault.to_account_info(),
                    event_authority: ctx.accounts.cond.vault_event_authority.to_account_info(),
                    program: ctx.accounts.cond.conditional_vault_program.to_account_info(),
                    token_program: ctx.accounts.ray.token_program.to_account_info(),
                },
                signer,
            )
            .with_remaining_accounts(vec![
                ctx.accounts.cond.pass_quote_mint.to_account_info(),
                ctx.accounts.cond.fail_quote_mint.to_account_info(),
                ctx.accounts.cond.sl_pool_pass_quote_vault.to_account_info(),
                ctx.accounts.cond.sl_pool_fail_quote_vault.to_account_info(),
            ]),
        )?;

        // Reload accounts to get final balances
        ctx.accounts.sl_pool_base_vault.reload()?;
        ctx.accounts.sl_pool_quote_vault.reload()?;

        let final_base_balance = ctx.accounts.sl_pool_base_vault.amount;
        let final_quote_balance = ctx.accounts.sl_pool_quote_vault.amount;

        // Provide the redeemed tokens back to Raydium
        let (
            token_0_account,
            token_1_account,
            token_0_vault,
            token_1_vault,
            vault_0_mint,
            vault_1_mint,
        ) = if ctx.accounts.sl_pool.is_base_token_0 {
            (
                ctx.accounts.sl_pool_base_vault.to_account_info(),
                ctx.accounts.sl_pool_quote_vault.to_account_info(),
                ctx.accounts.ray.spot_pool_base_vault.to_account_info(),
                ctx.accounts.ray.spot_pool_quote_vault.to_account_info(),
                ctx.accounts.base_mint.to_account_info(),
                ctx.accounts.quote_mint.to_account_info(),
            )
        } else {
            (
                ctx.accounts.sl_pool_quote_vault.to_account_info(),
                ctx.accounts.sl_pool_base_vault.to_account_info(),
                ctx.accounts.ray.spot_pool_quote_vault.to_account_info(),
                ctx.accounts.ray.spot_pool_base_vault.to_account_info(),
                ctx.accounts.quote_mint.to_account_info(),
                ctx.accounts.base_mint.to_account_info(),
            )
        };

        // Calculate LP tokens to mint (use the smaller amount to avoid slippage)
        let lp_tokens_to_mint = if ctx.accounts.sl_pool.is_base_token_0 {
            final_base_balance.min(final_quote_balance)
        } else {
            final_quote_balance.min(final_base_balance)
        };

        raydium_cpmm_cpi::cpi::deposit(
            CpiContext::new_with_signer(
                ctx.accounts.ray.cp_swap_program.to_account_info(),
                RaydiumDeposit {
                    owner: ctx.accounts.sl_pool.to_account_info(),
                    authority: ctx.accounts.ray.raydium_authority.to_account_info(),
                    pool_state: ctx.accounts.ray.spot_pool.to_account_info(),
                    owner_lp_token: ctx.accounts.sl_pool_spot_lp_vault.to_account_info(),
                    token_0_account,
                    token_1_account,
                    token_0_vault,
                    token_1_vault,
                    token_program: ctx.accounts.ray.token_program.to_account_info(),
                    token_program_2022: ctx.accounts.ray.token_program_2022.to_account_info(),
                    vault_0_mint,
                    vault_1_mint,
                    lp_mint: ctx.accounts.ray.lp_mint.to_account_info(),
                },
                signer,
            ),
            lp_tokens_to_mint,
            final_base_balance,
            final_quote_balance,
        )?;

        // Assert that at least 99.5% of the reserves have been put back into the spot AMM
        let total_original_reserves = initial_sl_pool_base_balance + initial_sl_pool_quote_balance;
        let total_final_reserves = final_base_balance + final_quote_balance;
        let percentage_returned = (total_final_reserves as f64 / total_original_reserves as f64) * 100.0;
        
        require!(
            percentage_returned >= 99.5,
            ErrorCode::InsufficientReservesReturned
        );

        // Clear the active proposal
        ctx.accounts.sl_pool.active_proposal = None;

        Ok(())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Proposal is not finalized")]
    ProposalNotFinalized,
    #[msg("No LP tokens to remove from AMM")]
    NoLpTokensToRemove,
    #[msg("No tokens received from AMM removal")]
    NoTokensFromAmm,
    #[msg("Insufficient reserves returned to spot AMM (less than 99.5%)")]
    InsufficientReservesReturned,
} 