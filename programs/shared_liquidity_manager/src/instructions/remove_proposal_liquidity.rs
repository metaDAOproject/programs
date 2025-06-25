use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::{Mint, TokenAccount, Token};

use anchor_lang::Discriminator;
use raydium_cpmm_cpi::{
    instruction,
    states::{OBSERVATION_SEED, POOL_LP_MINT_SEED, POOL_VAULT_SEED},
};

use crate::instructions::common::*;
use crate::error::SharedLiquidityManagerError;
use crate::state::SharedLiquidityPool;

#[derive(Accounts)]
pub struct RaydiumAccounts2<'info> {
    #[account(mut)]
    pub active_spot_pool: AccountLoader<'info, raydium_cpmm_cpi::states::PoolState>,
    #[account(mut)]
    pub active_spot_pool_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub active_spot_pool_quote_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub active_spot_pool_lp_mint: Box<InterfaceAccount<'info, anchor_spl::token_interface::Mint>>,
    pub token_program_2022: Program<'info, anchor_spl::token_interface::Token2022>,
    pub cp_swap_program: Program<'info, raydium_cpmm_cpi::program::RaydiumCpmm>,
    /// CHECK: SPL Memo program
    #[account(address = spl_memo::id())]
    pub memo_program: UncheckedAccount<'info>,

    /// CHECK: this is the next spot pool, init by cp-swap,
    #[account(
        mut,
        seeds = [
            b"spot_pool",
            sl_pool.key().as_ref(),
            &(sl_pool.active_spot_pool_index + 1).to_le_bytes()
        ],
        bump,
    )]
    pub next_spot_pool: UncheckedAccount<'info>,

    /// CHECK: next spot pool lp mint, init by cp-swap
    #[account(
        mut,
        seeds = [
            POOL_LP_MINT_SEED.as_bytes(),
            next_spot_pool.key().as_ref(),
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub next_spot_pool_lp_mint: UncheckedAccount<'info>,

    /// CHECK: next spot pool observation state, init by cp-swap
    #[account(
        mut,
        seeds = [
            OBSERVATION_SEED.as_bytes(),
            next_spot_pool.key().as_ref(),
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub next_spot_pool_observation_state: UncheckedAccount<'info>,

    /// CHECK: next spot pool base vault, init by cp-swap
    #[account(
        mut,
        seeds = [
            POOL_VAULT_SEED.as_bytes(),
            next_spot_pool.key().as_ref(),
            base_mint.key().as_ref(),
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub next_spot_pool_base_vault: UncheckedAccount<'info>,

    /// CHECK: next spot pool quote vault, init by cp-swap
    #[account(
        mut,
        seeds = [
            POOL_VAULT_SEED.as_bytes(),
            next_spot_pool.key().as_ref(),
            quote_mint.key().as_ref(),
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub next_spot_pool_quote_vault: UncheckedAccount<'info>,

    /// CHECK: next spot pool lp vault, init by cp-swap
    #[account(
        mut,
        address = get_associated_token_address(sl_pool_signer.key, next_spot_pool_lp_mint.key)
    )]
    pub sl_pool_next_spot_lp_vault: UncheckedAccount<'info>,

    /// CHECK: verified by raydium_cpmm_cpi
    pub observation_state: UncheckedAccount<'info>,

    pub sl_pool: Box<Account<'info, SharedLiquidityPool>>,
    /// CHECK: This is the shared liquidity pool signer
    pub sl_pool_signer: UncheckedAccount<'info>,
    pub base_mint: Box<Account<'info, Mint>>,
    pub quote_mint: Box<Account<'info, Mint>>,
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
    #[account(mut, token::mint = pass_base_mint, token::authority = sl_pool_signer)]
    pub sl_pool_pass_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = fail_base_mint, token::authority = sl_pool_signer)]
    pub sl_pool_fail_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = pass_quote_mint, token::authority = sl_pool_signer)]
    pub sl_pool_pass_quote_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = fail_quote_mint, token::authority = sl_pool_signer)]
    pub sl_pool_fail_quote_vault: Box<Account<'info, TokenAccount>>,
    /// CHECK: verified by conditional_vault
    pub vault_event_authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    /// CHECK: This is the shared liquidity pool signer
    #[account(mut)]
    pub sl_pool_signer: UncheckedAccount<'info>,
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
        constraint = sl_pool.active_spot_pool == ray.active_spot_pool.key()
    )]
    pub sl_pool: Account<'info, SharedLiquidityPool>,
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

    pub raydium_init_pool_static: InitializeRaydiumPoolStaticAccounts<'info>,

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
    pub token_program: Program<'info, Token>,
    /// CHECK: verified by autocrat
    pub autocrat_event_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,
}

impl RemoveProposalLiquidity<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.cond.question.is_resolved(),
            SharedLiquidityManagerError::ProposalNotFinalized
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        // Get the proposal outcome to determine which AMM to remove liquidity from
        let question = &ctx.accounts.cond.question;
        let payout_numerators = &question.payout_numerators;

        // Determine if the proposal passed (outcome 0) or failed (outcome 1)
        // payout_numerators[0] > payout_numerators[1] means outcome 0 (pass) won
        let proposal_passed = payout_numerators[1] > payout_numerators[0];

        let (
            amm_to_remove_from,
            lp_account_to_remove_from,
            base_vault_to_redeem,
            quote_vault_to_redeem,
            lp_mint,
            vault_ata_base,
            vault_ata_quote,
        ) = if proposal_passed {
            (
                ctx.accounts.ammm2.pass_amm.to_account_info(),
                &ctx.accounts.ammm2.sl_pool_pass_lp_account,
                ctx.accounts.cond.sl_pool_pass_base_vault.to_account_info(),
                ctx.accounts.cond.sl_pool_pass_quote_vault.to_account_info(),
                ctx.accounts.ammm2.pass_lp_mint.to_account_info(),
                ctx.accounts.ammm2.pass_amm_vault_ata_base.to_account_info(),
                ctx.accounts
                    .ammm2
                    .pass_amm_vault_ata_quote
                    .to_account_info(),
            )
        } else {
            (
                ctx.accounts.ammm2.fail_amm.to_account_info(),
                &ctx.accounts.ammm2.sl_pool_fail_lp_account,
                ctx.accounts.cond.sl_pool_fail_base_vault.to_account_info(),
                ctx.accounts.cond.sl_pool_fail_quote_vault.to_account_info(),
                ctx.accounts.ammm2.fail_lp_mint.to_account_info(),
                ctx.accounts.ammm2.fail_amm_vault_ata_base.to_account_info(),
                ctx.accounts
                    .ammm2
                    .fail_amm_vault_ata_quote
                    .to_account_info(),
            )
        };

        require!(
            lp_account_to_remove_from.amount > 0,
            SharedLiquidityManagerError::NoLpTokensToRemove
        );

        // Generate PDA seeds for signing
        let sl_pool_key = ctx.accounts.sl_pool.to_account_info().key;
        let seeds = &[
            b"sl_pool_signer".as_ref(),
            sl_pool_key.as_ref(),
            &[ctx.accounts.sl_pool.sl_pool_signer_bump],
        ];
        let signer = &[&seeds[..]];

        // Remove liquidity from the winning AMM
        amm::cpi::remove_liquidity(
            CpiContext::new_with_signer(
                ctx.accounts.ammm2.amm_program.to_account_info(),
                amm::cpi::accounts::AddOrRemoveLiquidity {
                    amm: amm_to_remove_from,
                    user: ctx.accounts.cond.sl_pool_signer.to_account_info(),
                    user_lp_account: lp_account_to_remove_from.to_account_info(),
                    user_base_account: base_vault_to_redeem,
                    user_quote_account: quote_vault_to_redeem,
                    vault_ata_base,
                    vault_ata_quote,
                    event_authority: ctx.accounts.ammm2.event_authority.to_account_info(),
                    program: ctx.accounts.ammm2.amm_program.to_account_info(),
                    lp_mint,
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
                signer,
            ),
            amm::instructions::RemoveLiquidityArgs {
                lp_tokens_to_burn: lp_account_to_remove_from.amount,
                min_base_amount: 0,
                min_quote_amount: 0,
            },
        )?;

        // Redeem base tokens
        conditional_vault::cpi::redeem_tokens(
            CpiContext::new_with_signer(
                ctx.accounts
                    .cond
                    .conditional_vault_program
                    .to_account_info(),
                conditional_vault::cpi::accounts::InteractWithVault {
                    question: ctx.accounts.cond.question.to_account_info(),
                    vault: ctx.accounts.cond.base_vault.to_account_info(),
                    vault_underlying_token_account: ctx
                        .accounts
                        .cond
                        .base_vault_underlying_token_account
                        .to_account_info(),
                    authority: ctx.accounts.cond.sl_pool_signer.to_account_info(),
                    user_underlying_token_account: ctx
                        .accounts
                        .sl_pool_base_vault
                        .to_account_info(),
                    event_authority: ctx.accounts.cond.vault_event_authority.to_account_info(),
                    program: ctx
                        .accounts
                        .cond
                        .conditional_vault_program
                        .to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
                signer,
            )
            .with_remaining_accounts(vec![
                ctx.accounts.cond.fail_base_mint.to_account_info(),
                ctx.accounts.cond.pass_base_mint.to_account_info(),
                ctx.accounts.cond.sl_pool_fail_base_vault.to_account_info(),
                ctx.accounts.cond.sl_pool_pass_base_vault.to_account_info(),
            ]),
        )?;

        let pre_redeem_quote_balance = ctx.accounts.sl_pool_quote_vault.amount;
        let pre_redeem_base_balance = ctx.accounts.sl_pool_base_vault.amount;

        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.cond.sl_pool_signer.to_account_info(),
                },
            ),
            // pool fee + 0.1 SOL for rent, we only need 0.05 now but Raydium
            // is upgradeable so I'd rather leave buffer
            ctx.accounts.raydium_init_pool_static.create_pool_fee.amount + 100_000_000,
        )?;

        // Redeem quote tokens
        conditional_vault::cpi::redeem_tokens(
            CpiContext::new_with_signer(
                ctx.accounts
                    .cond
                    .conditional_vault_program
                    .to_account_info(),
                conditional_vault::cpi::accounts::InteractWithVault {
                    question: ctx.accounts.cond.question.to_account_info(),
                    vault: ctx.accounts.cond.quote_vault.to_account_info(),
                    vault_underlying_token_account: ctx
                        .accounts
                        .cond
                        .quote_vault_underlying_token_account
                        .to_account_info(),
                    authority: ctx.accounts.cond.sl_pool_signer.to_account_info(),
                    user_underlying_token_account: ctx
                        .accounts
                        .sl_pool_quote_vault
                        .to_account_info(),
                    event_authority: ctx.accounts.cond.vault_event_authority.to_account_info(),
                    program: ctx
                        .accounts
                        .cond
                        .conditional_vault_program
                        .to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
                signer,
            )
            .with_remaining_accounts(vec![
                ctx.accounts.cond.fail_quote_mint.to_account_info(),
                ctx.accounts.cond.pass_quote_mint.to_account_info(),
                ctx.accounts.cond.sl_pool_fail_quote_vault.to_account_info(),
                ctx.accounts.cond.sl_pool_pass_quote_vault.to_account_info(),
            ]),
        )?;

        let (
            vault_0_mint,
            vault_1_mint,
            token_0_vault,
            token_1_vault,
            token_0_account,
            token_1_account,
        ) = if ctx.accounts.sl_pool.is_base_token_0 {
            (
                ctx.accounts.base_mint.to_account_info(),
                ctx.accounts.quote_mint.to_account_info(),
                ctx.accounts
                    .ray
                    .active_spot_pool_base_vault
                    .to_account_info(),
                ctx.accounts
                    .ray
                    .active_spot_pool_quote_vault
                    .to_account_info(),
                ctx.accounts.sl_pool_base_vault.to_account_info(),
                ctx.accounts.sl_pool_quote_vault.to_account_info(),
            )
        } else {
            (
                ctx.accounts.quote_mint.to_account_info(),
                ctx.accounts.base_mint.to_account_info(),
                ctx.accounts
                    .ray
                    .active_spot_pool_quote_vault
                    .to_account_info(),
                ctx.accounts
                    .ray
                    .active_spot_pool_base_vault
                    .to_account_info(),
                ctx.accounts.sl_pool_quote_vault.to_account_info(),
                ctx.accounts.sl_pool_base_vault.to_account_info(),
            )
        };

        raydium_cpmm_cpi::cpi::withdraw(
            CpiContext::new_with_signer(
                ctx.accounts.ray.cp_swap_program.to_account_info(),
                raydium_cpmm_cpi::cpi::accounts::Withdraw {
                    owner: ctx.accounts.ray.sl_pool_signer.to_account_info(),
                    authority: ctx.accounts.raydium_init_pool_static.raydium_authority.to_account_info(),
                    pool_state: ctx.accounts.ray.active_spot_pool.to_account_info(),
                    lp_mint: ctx.accounts.ray.active_spot_pool_lp_mint.to_account_info(),
                    memo_program: ctx.accounts.ray.memo_program.to_account_info(),
                    owner_lp_token: ctx.accounts.sl_pool_spot_lp_vault.to_account_info(),
                    token_0_account,
                    token_1_account,
                    vault_0_mint,
                    vault_1_mint,
                    token_0_vault,
                    token_1_vault,
                    token_program: ctx.accounts.token_program.to_account_info(),
                    token_program_2022: ctx.accounts.ray.token_program_2022.to_account_info(),
                },
                signer,
            ),
            ctx.accounts.sl_pool_spot_lp_vault.amount,
            0,
            0,
        )?;
        ctx.accounts.sl_pool_base_vault.reload()?;
        ctx.accounts.sl_pool_quote_vault.reload()?;

        let post_redeem_base_balance = ctx.accounts.sl_pool_base_vault.amount;
        let post_redeem_quote_balance = ctx.accounts.sl_pool_quote_vault.amount;

        let base_redeemed = post_redeem_base_balance - pre_redeem_base_balance;
        let quote_redeemed = post_redeem_quote_balance - pre_redeem_quote_balance;

        require!(
            base_redeemed > 0,
            SharedLiquidityManagerError::NoTokensFromAmm
        );
        require!(
            quote_redeemed > 0,
            SharedLiquidityManagerError::NoTokensFromAmm
        );

        let (
            init_amount_0,
            init_amount_1,
            token_0_mint,
            token_1_mint,
            creator_token_0,
            creator_token_1,
            token_0_vault,
            token_1_vault,
        ) = if ctx.accounts.sl_pool.is_base_token_0 {
            (
                base_redeemed,
                quote_redeemed,
                ctx.accounts.base_mint.to_account_info(),
                ctx.accounts.quote_mint.to_account_info(),
                ctx.accounts.sl_pool_base_vault.to_account_info(),
                ctx.accounts.sl_pool_quote_vault.to_account_info(),
                ctx.accounts.ray.next_spot_pool_base_vault.to_account_info(),
                ctx.accounts
                    .ray
                    .next_spot_pool_quote_vault
                    .to_account_info(),
            )
        } else {
            (
                quote_redeemed,
                base_redeemed,
                ctx.accounts.quote_mint.to_account_info(),
                ctx.accounts.base_mint.to_account_info(),
                ctx.accounts.sl_pool_quote_vault.to_account_info(),
                ctx.accounts.sl_pool_base_vault.to_account_info(),
                ctx.accounts
                    .ray
                    .next_spot_pool_quote_vault
                    .to_account_info(),
                ctx.accounts.ray.next_spot_pool_base_vault.to_account_info(),
            )
        };

        let cpi_accounts = raydium_cpmm_cpi::cpi::accounts::Initialize {
            creator: ctx.accounts.cond.sl_pool_signer.to_account_info(),
            authority: ctx.accounts.raydium_init_pool_static.raydium_authority.to_account_info(),
            pool_state: ctx.accounts.ray.next_spot_pool.to_account_info(),
            amm_config: ctx.accounts.raydium_init_pool_static.amm_config.to_account_info(),
            token_0_mint,
            token_1_mint,
            lp_mint: ctx.accounts.ray.next_spot_pool_lp_mint.to_account_info(),
            creator_token_0,
            creator_token_1,
            creator_lp_token: ctx
                .accounts
                .ray
                .sl_pool_next_spot_lp_vault
                .to_account_info(),
            token_0_program: ctx.accounts.token_program.to_account_info(),
            token_1_program: ctx.accounts.token_program.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            observation_state: ctx
                .accounts
                .ray
                .next_spot_pool_observation_state
                .to_account_info(),
            create_pool_fee: ctx.accounts.raydium_init_pool_static.create_pool_fee.to_account_info(),
            rent: ctx.accounts.raydium_init_pool_static.rent.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            token_0_vault,
            token_1_vault,
            associated_token_program: ctx.accounts.raydium_init_pool_static.associated_token_program.to_account_info(),
        };

        let ix = instruction::Initialize {
            init_amount_0,
            init_amount_1,
            open_time: 0,
        };
        let mut ix_data = Vec::with_capacity(256);
        ix_data.extend_from_slice(&instruction::Initialize::discriminator());
        AnchorSerialize::serialize(&ix, &mut ix_data)?;

        let ix = solana_program::instruction::Instruction {
            program_id: ctx.accounts.ray.cp_swap_program.key(),
            accounts: cpi_accounts
                .to_account_metas(None)
                .into_iter()
                .zip(cpi_accounts.to_account_infos())
                .map(|mut pair| {
                    pair.0.is_signer = pair.1.is_signer;
                    if pair.0.pubkey == ctx.accounts.cond.sl_pool_signer.key()
                        || pair.0.pubkey == ctx.accounts.ray.next_spot_pool.key()
                    {
                        pair.0.is_signer = true;
                    }
                    pair.0
                })
                .collect(),
            data: ix_data,
        };

        let spot_pool_index = 1_u32.to_le_bytes();
        let sl_pool_key = ctx.accounts.sl_pool.key();
        let pool_seeds = &[
            b"spot_pool",
            sl_pool_key.as_ref(),
            &spot_pool_index[..],
            &[ctx.bumps.ray.next_spot_pool],
        ];
        let raydium_signer = &[&pool_seeds[..], &seeds[..]];

        solana_program::program::invoke_signed(
            &ix,
            &cpi_accounts.to_account_infos(),
            raydium_signer,
        )?;

        ctx.accounts.sl_pool.active_spot_pool = ctx.accounts.ray.next_spot_pool.key();
        ctx.accounts.sl_pool.active_spot_pool_index += 1;
        ctx.accounts.sl_pool.sl_pool_spot_lp_vault = ctx.accounts.ray.sl_pool_next_spot_lp_vault.key();
        ctx.accounts.sl_pool.active_proposal = None;

        Ok(())
    }
}
