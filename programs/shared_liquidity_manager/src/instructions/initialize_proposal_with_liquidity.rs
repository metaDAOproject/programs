use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use raydium_cpmm_cpi::cpi::accounts::Withdraw;
use raydium_cpmm_cpi::cpi::withdraw;
use conditional_vault::cpi::accounts::InteractWithVault;
use conditional_vault::cpi::split_tokens;

use crate::state::SharedLiquidityPool;

#[derive(Accounts)]
pub struct RaydiumAccounts<'info> {
    #[account(mut)]
    pub spot_pool_state: AccountLoader<'info, raydium_cpmm_cpi::states::PoolState>,
    #[account(mut)]
    pub token_0_vault: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
    #[account(mut)]
    pub token_1_vault: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
    #[account(mut)]
    pub lp_mint: Box<InterfaceAccount<'info, anchor_spl::token_interface::Mint>>,
    #[account(mut)]
    pub pool_lp_token_account: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
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
pub struct ConditionalVaultAccounts<'info> {
    #[account(mut)]
    pub question: Account<'info, conditional_vault::state::Question>,
    #[account(mut)]
    pub vault_0: Account<'info, conditional_vault::state::ConditionalVault>,
    #[account(mut)]
    pub vault_1: Account<'info, conditional_vault::state::ConditionalVault>,
    #[account(mut)]
    pub vault_0_underlying_token_account: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
    #[account(mut)]
    pub vault_1_underlying_token_account: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
    #[account(mut)]
    pub pool_token_0_account: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
    #[account(mut)]
    pub pool_token_1_account: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
    pub conditional_vault_program: Program<'info, conditional_vault::program::ConditionalVault>,
    #[account(mut)]
    pub token_0_pass_mint: Box<InterfaceAccount<'info, anchor_spl::token_interface::Mint>>,
    #[account(mut)]
    pub token_0_fail_mint: Box<InterfaceAccount<'info, anchor_spl::token_interface::Mint>>,
    #[account(mut)]
    pub token_1_pass_mint: Box<InterfaceAccount<'info, anchor_spl::token_interface::Mint>>,
    #[account(mut)]
    pub token_1_fail_mint: Box<InterfaceAccount<'info, anchor_spl::token_interface::Mint>>,
    #[account(init, payer = payer, token::mint = token_0_pass_mint, token::authority = token_0_pass_vault)]
    pub token_0_pass_vault: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
    #[account(init, payer = payer, token::mint = token_0_fail_mint, token::authority = token_0_fail_vault)]
    pub token_0_fail_vault: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
    #[account(init, payer = payer, token::mint = token_1_pass_mint, token::authority = token_1_pass_vault)]
    pub token_1_pass_vault: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
    #[account(init, payer = payer, token::mint = token_1_fail_mint, token::authority = token_1_fail_vault)]
    pub token_1_fail_vault: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
    /// CHECK: verified by conditional_vault
    pub vault_event_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, anchor_spl::token::Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConditionalTokenAccounts<'info> {
    #[account(mut)]
    pub pool_p_token_0_account: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
    #[account(mut)]
    pub pool_f_token_0_account: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
    #[account(mut)]
    pub pool_p_token_1_account: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
    #[account(mut)]
    pub pool_f_token_1_account: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
}

#[derive(Accounts)]
pub struct AmmAccounts<'info> {
    #[account(mut)]
    pub pass_amm: Account<'info, amm::state::Amm>,
    #[account(mut)]
    pub fail_amm: Account<'info, amm::state::Amm>,
    #[account(mut)]
    pub pass_lp_mint: Box<Account<'info, anchor_spl::token::Mint>>,
    #[account(mut)]
    pub fail_lp_mint: Box<Account<'info, anchor_spl::token::Mint>>,
    #[account(mut)]
    pub pool_pass_lp_account: Box<Account<'info, anchor_spl::token::TokenAccount>>,
    #[account(mut)]
    pub pool_fail_lp_account: Box<Account<'info, anchor_spl::token::TokenAccount>>,
    #[account(mut)]
    pub pass_amm_vault_ata_base: Box<Account<'info, anchor_spl::token::TokenAccount>>,
    #[account(mut)]
    pub pass_amm_vault_ata_quote: Box<Account<'info, anchor_spl::token::TokenAccount>>,
    #[account(mut)]
    pub fail_amm_vault_ata_base: Box<Account<'info, anchor_spl::token::TokenAccount>>,
    #[account(mut)]
    pub fail_amm_vault_ata_quote: Box<Account<'info, anchor_spl::token::TokenAccount>>,
    pub amm_program: Program<'info, amm::program::Amm>,
}

#[event_cpi]
#[derive(Accounts)]
pub struct InitializeProposalWithLiquidity<'info> {
    // Shared liquidity pool state
    #[account(mut, has_one = token_0_vault, has_one = token_1_vault)]
    pub pool: Account<'info, SharedLiquidityPool>,
    pub proposal_creator: Signer<'info>,
    /// CHECK: initialized by autocrat
    pub proposal: UncheckedAccount<'info>,

    #[account(mut)]
    pub token_0_vault: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,
    #[account(mut)]
    pub token_1_vault: Box<InterfaceAccount<'info, anchor_spl::token_interface::TokenAccount>>,

    pub token_0_mint: Box<InterfaceAccount<'info, anchor_spl::token_interface::Mint>>,
    pub token_1_mint: Box<InterfaceAccount<'info, anchor_spl::token_interface::Mint>>,

    // Raydium accounts
    pub raydium: RaydiumAccounts<'info>,

    // Conditional vault accounts
    pub conditional_vault: ConditionalVaultAccounts<'info>,

    // Conditional token accounts
    // pub conditional_tokens: ConditionalTokenAccounts<'info>,

    // AMM accounts
    // pub amm: AmmAccounts<'info>,

    // Autocrat accounts
    #[account(mut)]
    pub dao: Account<'info, autocrat::state::Dao>,
    pub autocrat_program: Program<'info, autocrat::program::Autocrat>,
    pub system_program: Program<'info, System>,
}

impl InitializeProposalWithLiquidity<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        // 1. Withdraw half of the pool's LP tokens from Raydium
        let pool_lp_balance = ctx.accounts.raydium.pool_lp_token_account.amount;
        require!(pool_lp_balance > 0, ErrorCode::NoLpTokensInPool);
        let half_lp = pool_lp_balance / 2;
        require!(half_lp > 0, ErrorCode::NotEnoughLpTokens);

        // Prepare Raydium Withdraw CPI accounts
        let cpi_accounts = Withdraw {
            owner: ctx.accounts.pool.to_account_info(),
            authority: ctx.accounts.raydium.raydium_authority.to_account_info(),
            pool_state: ctx.accounts.raydium.spot_pool_state.to_account_info(),
            owner_lp_token: ctx.accounts.raydium.pool_lp_token_account.to_account_info(),
            token_0_account: ctx.accounts.token_0_vault.to_account_info(),
            token_1_account: ctx.accounts.token_1_vault.to_account_info(),
            token_0_vault: ctx.accounts.raydium.token_0_vault.to_account_info(),
            token_1_vault: ctx.accounts.raydium.token_1_vault.to_account_info(),
            token_program: ctx.accounts.raydium.token_program.to_account_info(),
            token_program_2022: ctx.accounts.raydium.token_program_2022.to_account_info(),
            vault_0_mint: ctx.accounts.token_0_mint.to_account_info(),
            vault_1_mint: ctx.accounts.token_1_mint.to_account_info(),
            lp_mint: ctx.accounts.raydium.lp_mint.to_account_info(),
            memo_program: ctx.accounts.raydium.memo_program.to_account_info(),
        };
        let spot_pool_state = ctx.accounts.raydium.spot_pool_state.key();
        let dao = ctx.accounts.dao.key();
        let seeds = &[
            b"pool".as_ref(),
            spot_pool_state.as_ref(),
            dao.as_ref(),
            &[ctx.accounts.pool.pda_bump],
        ];
        let signer = &[&seeds[..]];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.raydium.cp_swap_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        // 0 minimums as per user request
        withdraw(
            cpi_ctx,
            half_lp,
            0,
            0,
        )?;

        // msg!("{:?}", ctx.accounts.conditional_vault.token_0_pass_vault);
        // msg!("{:?}", ctx.accounts.conditional_vault.token_0_pass_mint);
        conditional_vault::cpi::split_tokens(
            CpiContext::new_with_signer(
                ctx.accounts.conditional_vault.conditional_vault_program.to_account_info(),
                conditional_vault::cpi::accounts::InteractWithVault {
                    question: ctx.accounts.conditional_vault.question.to_account_info(),
                    vault: ctx.accounts.conditional_vault.vault_0.to_account_info(),
                    vault_underlying_token_account: ctx.accounts.conditional_vault.vault_0_underlying_token_account.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                    user_underlying_token_account: ctx.accounts.token_0_vault.to_account_info(),
                    event_authority: ctx.accounts.conditional_vault.vault_event_authority.to_account_info(),
                    program: ctx.accounts.conditional_vault.conditional_vault_program.to_account_info(),
                    token_program: ctx.accounts.raydium.token_program.to_account_info(),
                },
                signer,
            ).with_remaining_accounts(vec![
                ctx.accounts.conditional_vault.token_0_fail_mint.to_account_info(),
                ctx.accounts.conditional_vault.token_0_pass_mint.to_account_info(),
                ctx.accounts.conditional_vault.token_0_fail_vault.to_account_info(),
                ctx.accounts.conditional_vault.token_0_pass_vault.to_account_info(),
            ]),
            1,
        )?;

        // // 2. Split withdrawn tokens into conditional variants
        // // Split token_0
        // let split_token_0_accounts = InteractWithVault {
        //     question: ctx.accounts.conditional_vault.question.to_account_info(),
        //     vault: ctx.accounts.conditional_vault.vault_0.to_account_info(),
        //     token_program: ctx.accounts.raydium.token_program.to_account_info(),
        // };
        // let cpi_ctx = CpiContext::new(
        //     ctx.accounts.conditional_vault.conditional_vault_program.to_account_info(),
        //     split_token_0_accounts,
        // );
        // split(cpi_ctx)?;

        // Split token_1
        // let split_token_1_accounts = Split {
        //     question: ctx.accounts.conditional_vault.question.to_account_info(),
        //     vault: ctx.accounts.conditional_vault.vault_1.to_account_info(),
        //     underlying_token_account: ctx.accounts.conditional_vault.vault_1_underlying_token_account.to_account_info(),
        //     conditional_token_account: ctx.accounts.conditional_vault.pool_token_1_account.to_account_info(),
        //     token_program: ctx.accounts.raydium.token_program.to_account_info(),
        //     token_program_2022: ctx.accounts.raydium.token_program_2022.to_account_info(),
        // };
        // let cpi_ctx = CpiContext::new(
        //     ctx.accounts.conditional_vault.conditional_vault_program.to_account_info(),
        //     split_token_1_accounts,
        // );
        // split(cpi_ctx)?;

        // TODO: Step 3: Provide liquidity to pass_amm and fail_amm using conditional tokens
        // TODO: Step 4: Lock all received LP tokens into autocrat proposal

        Ok(())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("No LP tokens in pool's LP token account")] 
    NoLpTokensInPool,
    #[msg("Not enough LP tokens to withdraw half")] 
    NotEnoughLpTokens,
} 