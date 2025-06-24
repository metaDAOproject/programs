use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

use raydium_cpmm_cpi::cpi::accounts::Withdraw as RaydiumWithdraw;

use crate::error::SharedLiquidityManagerError;
use crate::state::{DraftProposal, DraftProposalStatus, SharedLiquidityPool};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeProposalWithLiquidityParams {
    pub nonce: u64,
}

#[derive(Accounts)]
pub struct RaydiumAccounts<'info> {
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
pub struct ConditionalVaultAccounts<'info> {
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
    #[account(init, payer = payer, token::mint = pass_base_mint, token::authority = sl_pool_signer)]
    pub sl_pool_pass_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(init, payer = payer, token::mint = fail_base_mint, token::authority = sl_pool_signer)]
    pub sl_pool_fail_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(init, payer = payer, token::mint = pass_quote_mint, token::authority = sl_pool_signer)]
    pub sl_pool_pass_quote_vault: Box<Account<'info, TokenAccount>>,
    #[account(init, payer = payer, token::mint = fail_quote_mint, token::authority = sl_pool_signer)]
    pub sl_pool_fail_quote_vault: Box<Account<'info, TokenAccount>>,
    /// CHECK: verified by conditional_vault
    pub vault_event_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, anchor_spl::token::Token>,
    pub system_program: Program<'info, System>,
    /// CHECK: the signer
    #[account(mut)]
    pub sl_pool_signer: UncheckedAccount<'info>,
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
    #[account(init_if_needed, payer = payer, associated_token::mint = pass_lp_mint, associated_token::authority = sl_pool_signer)]
    pub sl_pool_pass_lp_account: Box<Account<'info, TokenAccount>>,
    #[account(init_if_needed, payer = payer, associated_token::mint = fail_lp_mint, associated_token::authority = sl_pool_signer)]
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
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, anchor_spl::token::Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    /// CHECK: the signer
    pub sl_pool_signer: UncheckedAccount<'info>,
}

#[event_cpi]
#[derive(Accounts)]
pub struct InitializeProposalWithLiquidity<'info> {
    // Shared liquidity pool state
    #[account(mut,
        has_one = sl_pool_base_vault,
        has_one = sl_pool_quote_vault,
        has_one = sl_pool_spot_lp_vault,
        has_one = base_mint,
        has_one = quote_mint,
        constraint = shared_liquidity_pool.active_spot_pool == raydium.spot_pool.key()
    )]
    pub shared_liquidity_pool: Account<'info, SharedLiquidityPool>,
    pub proposal_creator: Signer<'info>,
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
    pub raydium: RaydiumAccounts<'info>,

    // Conditional vault accounts
    pub conditional_vault: ConditionalVaultAccounts<'info>,

    // AMM accounts
    pub amm: AmmAccounts<'info>,

    #[account(mut, has_one = shared_liquidity_pool)]
    pub draft_proposal: Box<Account<'info, DraftProposal>>,

    // Autocrat accounts
    #[account(mut)]
    pub dao: Box<Account<'info, autocrat::state::Dao>>,
    pub autocrat_program: Program<'info, autocrat::program::Autocrat>,
    pub system_program: Program<'info, System>,
    /// CHECK: verified by autocrat
    pub autocrat_event_authority: UncheckedAccount<'info>,
}

impl InitializeProposalWithLiquidity<'_> {
    pub fn validate(&self) -> Result<()> {
        let total_supply = self.base_mint.supply;
        let stake_threshold = (total_supply
            * self.shared_liquidity_pool.proposal_stake_rate_threshold_bps as u64)
            / 10_000;
        require_gte!(self.draft_proposal.staked_token_amount, stake_threshold);

        require_eq!(self.draft_proposal.status, DraftProposalStatus::Draft);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: InitializeProposalWithLiquidityParams) -> Result<()> {
        // 1. Withdraw half of the pool's LP tokens from Raydium
        let pool_lp_balance = ctx.accounts.sl_pool_spot_lp_vault.amount;
        require!(
            pool_lp_balance > 0,
            SharedLiquidityManagerError::NoLpTokensInPool
        );
        let half_lp = pool_lp_balance / 2;
        require!(half_lp > 0, SharedLiquidityManagerError::NotEnoughLpTokens);

        // Get initial token balances
        let initial_base_balance = ctx.accounts.sl_pool_base_vault.amount;
        let initial_quote_balance = ctx.accounts.sl_pool_quote_vault.amount;

        let (
            token_0_account,
            token_1_account,
            vault_0_mint,
            vault_1_mint,
            token_0_vault,
            token_1_vault,
        ) = if ctx.accounts.shared_liquidity_pool.is_base_token_0 {
            (
                ctx.accounts.sl_pool_base_vault.to_account_info(),
                ctx.accounts.sl_pool_quote_vault.to_account_info(),
                ctx.accounts.base_mint.to_account_info(),
                ctx.accounts.quote_mint.to_account_info(),
                ctx.accounts.raydium.spot_pool_base_vault.to_account_info(),
                ctx.accounts.raydium.spot_pool_quote_vault.to_account_info(),
            )
        } else {
            (
                ctx.accounts.sl_pool_quote_vault.to_account_info(),
                ctx.accounts.sl_pool_base_vault.to_account_info(),
                ctx.accounts.quote_mint.to_account_info(),
                ctx.accounts.base_mint.to_account_info(),
                ctx.accounts.raydium.spot_pool_quote_vault.to_account_info(),
                ctx.accounts.raydium.spot_pool_base_vault.to_account_info(),
            )
        };

        let sl_pool_key = ctx.accounts.shared_liquidity_pool.key();
        let seeds = &[
            b"sl_pool_signer".as_ref(),
            sl_pool_key.as_ref(),
            &[ctx.accounts.shared_liquidity_pool.sl_pool_signer_bump],
        ];
        let signer = &[&seeds[..]];

        // Withdraw half from Raydium
        raydium_cpmm_cpi::cpi::withdraw(
            CpiContext::new_with_signer(
                ctx.accounts.raydium.cp_swap_program.to_account_info(),
                RaydiumWithdraw {
                    owner: ctx
                        .accounts
                        .conditional_vault
                        .sl_pool_signer
                        .to_account_info(),
                    authority: ctx.accounts.raydium.raydium_authority.to_account_info(),
                    pool_state: ctx.accounts.raydium.spot_pool.to_account_info(),
                    lp_mint: ctx.accounts.raydium.lp_mint.to_account_info(),
                    memo_program: ctx.accounts.raydium.memo_program.to_account_info(),
                    owner_lp_token: ctx.accounts.sl_pool_spot_lp_vault.to_account_info(),
                    token_0_account,
                    token_1_account,
                    vault_0_mint,
                    vault_1_mint,
                    token_0_vault,
                    token_1_vault,
                    token_program: ctx.accounts.raydium.token_program.to_account_info(),
                    token_program_2022: ctx.accounts.raydium.token_program_2022.to_account_info(),
                },
                signer,
            ),
            half_lp,
            0,
            0,
        )?;

        // Calculate how many tokens we got from the withdraw

        ctx.accounts.sl_pool_base_vault.reload()?;
        ctx.accounts.sl_pool_quote_vault.reload()?;

        let base_withdrawn = ctx.accounts.sl_pool_base_vault.amount - initial_base_balance;
        let quote_withdrawn = ctx.accounts.sl_pool_quote_vault.amount - initial_quote_balance;

        require!(
            base_withdrawn > 0,
            SharedLiquidityManagerError::NotEnoughLpTokens
        );
        require!(
            quote_withdrawn > 0,
            SharedLiquidityManagerError::NotEnoughLpTokens
        );

        // Split base
        conditional_vault::cpi::split_tokens(
            CpiContext::new_with_signer(
                ctx.accounts
                    .conditional_vault
                    .conditional_vault_program
                    .to_account_info(),
                conditional_vault::cpi::accounts::InteractWithVault {
                    question: ctx.accounts.conditional_vault.question.to_account_info(),
                    vault: ctx.accounts.conditional_vault.base_vault.to_account_info(),
                    vault_underlying_token_account: ctx
                        .accounts
                        .conditional_vault
                        .base_vault_underlying_token_account
                        .to_account_info(),
                    authority: ctx
                        .accounts
                        .conditional_vault
                        .sl_pool_signer
                        .to_account_info(),
                    user_underlying_token_account: ctx
                        .accounts
                        .sl_pool_base_vault
                        .to_account_info(),
                    event_authority: ctx
                        .accounts
                        .conditional_vault
                        .vault_event_authority
                        .to_account_info(),
                    program: ctx
                        .accounts
                        .conditional_vault
                        .conditional_vault_program
                        .to_account_info(),
                    token_program: ctx.accounts.raydium.token_program.to_account_info(),
                },
                signer,
            )
            .with_remaining_accounts(vec![
                ctx.accounts
                    .conditional_vault
                    .fail_base_mint
                    .to_account_info(),
                ctx.accounts
                    .conditional_vault
                    .pass_base_mint
                    .to_account_info(),
                ctx.accounts
                    .conditional_vault
                    .sl_pool_fail_base_vault
                    .to_account_info(),
                ctx.accounts
                    .conditional_vault
                    .sl_pool_pass_base_vault
                    .to_account_info(),
            ]),
            base_withdrawn,
        )?;

        // Split quote
        conditional_vault::cpi::split_tokens(
            CpiContext::new_with_signer(
                ctx.accounts
                    .conditional_vault
                    .conditional_vault_program
                    .to_account_info(),
                conditional_vault::cpi::accounts::InteractWithVault {
                    question: ctx.accounts.conditional_vault.question.to_account_info(),
                    vault: ctx.accounts.conditional_vault.quote_vault.to_account_info(),
                    vault_underlying_token_account: ctx
                        .accounts
                        .conditional_vault
                        .quote_vault_underlying_token_account
                        .to_account_info(),
                    authority: ctx
                        .accounts
                        .conditional_vault
                        .sl_pool_signer
                        .to_account_info(),
                    user_underlying_token_account: ctx
                        .accounts
                        .sl_pool_quote_vault
                        .to_account_info(),
                    event_authority: ctx
                        .accounts
                        .conditional_vault
                        .vault_event_authority
                        .to_account_info(),
                    program: ctx
                        .accounts
                        .conditional_vault
                        .conditional_vault_program
                        .to_account_info(),
                    token_program: ctx.accounts.raydium.token_program.to_account_info(),
                },
                signer,
            )
            .with_remaining_accounts(vec![
                ctx.accounts
                    .conditional_vault
                    .fail_quote_mint
                    .to_account_info(),
                ctx.accounts
                    .conditional_vault
                    .pass_quote_mint
                    .to_account_info(),
                ctx.accounts
                    .conditional_vault
                    .sl_pool_fail_quote_vault
                    .to_account_info(),
                ctx.accounts
                    .conditional_vault
                    .sl_pool_pass_quote_vault
                    .to_account_info(),
            ]),
            quote_withdrawn,
        )?;

        // LP into the pass and fail AMMs

        require_eq!(ctx.accounts.amm.pass_lp_mint.supply, 0);
        require_eq!(ctx.accounts.amm.fail_lp_mint.supply, 0);

        amm::cpi::add_liquidity(
            CpiContext::new_with_signer(
                ctx.accounts.amm.amm_program.to_account_info(),
                amm::cpi::accounts::AddOrRemoveLiquidity {
                    amm: ctx.accounts.amm.pass_amm.to_account_info(),
                    user: ctx
                        .accounts
                        .conditional_vault
                        .sl_pool_signer
                        .to_account_info(),
                    user_lp_account: ctx.accounts.amm.sl_pool_pass_lp_account.to_account_info(),
                    user_base_account: ctx
                        .accounts
                        .conditional_vault
                        .sl_pool_pass_base_vault
                        .to_account_info(),
                    user_quote_account: ctx
                        .accounts
                        .conditional_vault
                        .sl_pool_pass_quote_vault
                        .to_account_info(),
                    vault_ata_base: ctx.accounts.amm.pass_amm_vault_ata_base.to_account_info(),
                    vault_ata_quote: ctx.accounts.amm.pass_amm_vault_ata_quote.to_account_info(),
                    event_authority: ctx.accounts.amm.event_authority.to_account_info(),
                    program: ctx.accounts.amm.amm_program.to_account_info(),
                    lp_mint: ctx.accounts.amm.pass_lp_mint.to_account_info(),
                    token_program: ctx.accounts.raydium.token_program.to_account_info(),
                },
                signer,
            ),
            amm::instructions::AddLiquidityArgs {
                max_base_amount: base_withdrawn,
                quote_amount: quote_withdrawn,
                min_lp_tokens: quote_withdrawn,
            },
        )?;

        amm::cpi::add_liquidity(
            CpiContext::new_with_signer(
                ctx.accounts.amm.amm_program.to_account_info(),
                amm::cpi::accounts::AddOrRemoveLiquidity {
                    amm: ctx.accounts.amm.fail_amm.to_account_info(),
                    user: ctx
                        .accounts
                        .conditional_vault
                        .sl_pool_signer
                        .to_account_info(),
                    user_lp_account: ctx.accounts.amm.sl_pool_fail_lp_account.to_account_info(),
                    user_base_account: ctx
                        .accounts
                        .conditional_vault
                        .sl_pool_fail_base_vault
                        .to_account_info(),
                    user_quote_account: ctx
                        .accounts
                        .conditional_vault
                        .sl_pool_fail_quote_vault
                        .to_account_info(),
                    vault_ata_base: ctx.accounts.amm.fail_amm_vault_ata_base.to_account_info(),
                    vault_ata_quote: ctx.accounts.amm.fail_amm_vault_ata_quote.to_account_info(),
                    event_authority: ctx.accounts.amm.event_authority.to_account_info(),
                    program: ctx.accounts.amm.amm_program.to_account_info(),
                    lp_mint: ctx.accounts.amm.fail_lp_mint.to_account_info(),
                    token_program: ctx.accounts.raydium.token_program.to_account_info(),
                },
                signer,
            ),
            amm::instructions::AddLiquidityArgs {
                max_base_amount: base_withdrawn,
                quote_amount: quote_withdrawn,
                min_lp_tokens: quote_withdrawn,
            },
        )?;

        autocrat::cpi::initialize_proposal(
            CpiContext::new_with_signer(
                ctx.accounts.autocrat_program.to_account_info(),
                autocrat::cpi::accounts::InitializeProposal {
                    proposal: ctx.accounts.proposal.to_account_info(),
                    dao: ctx.accounts.dao.to_account_info(),
                    question: ctx.accounts.conditional_vault.question.to_account_info(),
                    quote_vault: ctx.accounts.conditional_vault.quote_vault.to_account_info(),
                    base_vault: ctx.accounts.conditional_vault.base_vault.to_account_info(),
                    pass_amm: ctx.accounts.amm.pass_amm.to_account_info(),
                    pass_lp_mint: ctx.accounts.amm.pass_lp_mint.to_account_info(),
                    fail_amm: ctx.accounts.amm.fail_amm.to_account_info(),
                    fail_lp_mint: ctx.accounts.amm.fail_lp_mint.to_account_info(),
                    pass_lp_user_account: ctx
                        .accounts
                        .amm
                        .sl_pool_pass_lp_account
                        .to_account_info(),
                    fail_lp_user_account: ctx
                        .accounts
                        .amm
                        .sl_pool_fail_lp_account
                        .to_account_info(),
                    pass_lp_vault_account: ctx
                        .accounts
                        .amm
                        .proposal_pass_lp_vault
                        .to_account_info(),
                    fail_lp_vault_account: ctx
                        .accounts
                        .amm
                        .proposal_fail_lp_vault
                        .to_account_info(),
                    proposer: ctx
                        .accounts
                        .conditional_vault
                        .sl_pool_signer
                        .to_account_info(),
                    payer: ctx.accounts.proposal_creator.to_account_info(),
                    event_authority: ctx.accounts.autocrat_event_authority.to_account_info(),
                    program: ctx.accounts.autocrat_program.to_account_info(),
                    token_program: ctx.accounts.raydium.token_program.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                },
                signer,
            ),
            autocrat::instructions::InitializeProposalParams {
                description_url: "".to_string(),
                instruction: ctx.accounts.draft_proposal.instruction.clone().into(),
                pass_lp_tokens_to_lock: quote_withdrawn,
                fail_lp_tokens_to_lock: quote_withdrawn,
                nonce: params.nonce,
            },
        )?;

        ctx.accounts.draft_proposal.status = DraftProposalStatus::Initialized;

        Ok(())
    }
}
