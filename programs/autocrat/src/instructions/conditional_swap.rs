use amm::instructions::swap;

use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct ConditionalSwapParams {
    pub market: Market,
    pub swap_type: SwapType,
    pub input_amount: u64,
    pub min_output_amount: u64,
}

#[derive(Accounts)]
pub struct ConditionalSwap<'info> {
    #[account(mut, has_one = amm_base_vault, has_one = amm_quote_vault)]
    pub futarchy_amm: Box<Account<'info, FutarchyAmm>>,
    #[account(mut, associated_token::mint = futarchy_amm.base_mint, associated_token::authority = futarchy_amm)]
    pub amm_base_vault: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = futarchy_amm.quote_mint, associated_token::authority = futarchy_amm)]
    pub amm_quote_vault: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = base_vault.conditional_token_mints[1], associated_token::authority = futarchy_amm)]
    pub amm_pass_base_vault: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = quote_vault.conditional_token_mints[1], associated_token::authority = futarchy_amm)]
    pub amm_pass_quote_vault: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = base_vault.conditional_token_mints[0], associated_token::authority = futarchy_amm)]
    pub amm_fail_base_vault: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = quote_vault.conditional_token_mints[0], associated_token::authority = futarchy_amm)]
    pub amm_fail_quote_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_input_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_output_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub base_vault: Box<Account<'info, conditional_vault::state::ConditionalVault>>,
    #[account(mut)]
    pub base_vault_underlying_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub quote_vault_underlying_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub quote_vault: Box<Account<'info, conditional_vault::state::ConditionalVault>>,
    pub token_program: Program<'info, Token>,
    pub trader: Signer<'info>,
    #[account(mut)]
    pub pass_base_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub fail_base_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub pass_quote_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub fail_quote_mint: Box<Account<'info, Mint>>,
    pub conditional_vault_program: Program<'info, ConditionalVaultProgram>,
    /// CHECK:
    pub vault_event_authority: UncheckedAccount<'info>,
    pub question: Account<'info, Question>,
}

impl ConditionalSwap<'_> {
    pub fn handle(ctx: Context<Self>, params: ConditionalSwapParams) -> Result<()> {
        let ConditionalSwapParams {
            market,
            swap_type,
            input_amount,
            min_output_amount,
        } = params;

        assert_ne!(market, Market::Spot);

        let output_amount =
            ctx.accounts
                .futarchy_amm
                .state
                .swap(input_amount, swap_type, market)?;

        require_gte!(output_amount, min_output_amount);

        // You need to transfer in before you can do merges of in
        // You need to do split of out before you can do transfers of out

        let amm_input_account = match (swap_type, market) {
            (SwapType::Buy, Market::Pass) => &ctx.accounts.amm_pass_quote_vault,
            (SwapType::Sell, Market::Pass) => &ctx.accounts.amm_pass_base_vault,
            (SwapType::Buy, Market::Fail) => &ctx.accounts.amm_fail_quote_vault,
            (SwapType::Sell, Market::Fail) => &ctx.accounts.amm_fail_base_vault,
            (_, Market::Spot) => unreachable!(),
        };

        require_gte!(ctx.accounts.user_input_account.amount, input_amount);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_input_account.to_account_info(),
                    to: amm_input_account.to_account_info(),
                    authority: ctx.accounts.trader.to_account_info(),
                },
            ),
            input_amount,
        )?;

        // We reload these to ensure that `quote_mergeable` and `base_mergeable` are accurate
        ctx.accounts.amm_pass_base_vault.reload()?;
        ctx.accounts.amm_pass_quote_vault.reload()?;
        ctx.accounts.amm_fail_base_vault.reload()?;
        ctx.accounts.amm_fail_quote_vault.reload()?;

        let signer_seeds = &[
            b"futarchy_amm".as_ref(),
            &[ctx.accounts.futarchy_amm.pda_bump],
        ];
        let signer = &[&signer_seeds[..]];

        let quote_cpi_context = CpiContext::new_with_signer(
            ctx.accounts.conditional_vault_program.to_account_info(),
            conditional_vault::cpi::accounts::InteractWithVault {
                question: ctx.accounts.question.to_account_info(),
                vault: ctx.accounts.quote_vault.to_account_info(),
                vault_underlying_token_account: ctx
                    .accounts
                    .quote_vault_underlying_token_account
                    .to_account_info(),
                authority: ctx.accounts.futarchy_amm.to_account_info(),
                user_underlying_token_account: ctx.accounts.amm_quote_vault.to_account_info(),
                event_authority: ctx.accounts.vault_event_authority.to_account_info(),
                program: ctx.accounts.conditional_vault_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            signer,
        )
        .with_remaining_accounts(vec![
            ctx.accounts.fail_quote_mint.to_account_info(),
            ctx.accounts.pass_quote_mint.to_account_info(),
            ctx.accounts.amm_fail_quote_vault.to_account_info(),
            ctx.accounts.amm_pass_quote_vault.to_account_info(),
        ]);

        let amm_output_account = match (swap_type, market) {
            (SwapType::Buy, Market::Pass) => &ctx.accounts.amm_pass_base_vault,
            (SwapType::Sell, Market::Pass) => &ctx.accounts.amm_pass_quote_vault,
            (SwapType::Buy, Market::Fail) => &ctx.accounts.amm_fail_base_vault,
            (SwapType::Sell, Market::Fail) => &ctx.accounts.amm_fail_quote_vault,
            (_, Market::Spot) => unreachable!(),
        };

        // If the user is buying, we should have just received some quote to merge
        // If they're selling, we might need to split some quote
        match swap_type {
            SwapType::Buy => {
                let quote_mergeable = std::cmp::min(
                    ctx.accounts.amm_fail_quote_vault.amount,
                    ctx.accounts.amm_pass_quote_vault.amount,
                );

                if quote_mergeable > 0 {
                    conditional_vault::cpi::merge_tokens(quote_cpi_context, quote_mergeable)?
                }
            }
            SwapType::Sell => {
                let amount_to_split = output_amount.saturating_sub(amm_output_account.amount);
                if amount_to_split > 0 {
                    conditional_vault::cpi::split_tokens(
                        quote_cpi_context,
                        amount_to_split,
                    )?
                }
            }
        }

        let base_cpi_context = CpiContext::new_with_signer(
            ctx.accounts.conditional_vault_program.to_account_info(),
            conditional_vault::cpi::accounts::InteractWithVault {
                question: ctx.accounts.question.to_account_info(),
                vault: ctx.accounts.base_vault.to_account_info(),
                vault_underlying_token_account: ctx
                    .accounts
                    .base_vault_underlying_token_account
                    .to_account_info(),
                authority: ctx.accounts.futarchy_amm.to_account_info(),
                user_underlying_token_account: ctx.accounts.amm_base_vault.to_account_info(),
                event_authority: ctx.accounts.vault_event_authority.to_account_info(),
                program: ctx.accounts.conditional_vault_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            signer,
        )
        .with_remaining_accounts(vec![
            ctx.accounts.fail_base_mint.to_account_info(),
            ctx.accounts.pass_base_mint.to_account_info(),
            ctx.accounts.amm_fail_base_vault.to_account_info(),
            ctx.accounts.amm_pass_base_vault.to_account_info(),
        ]);

        match swap_type {
            SwapType::Buy => {
                let amount_to_split = output_amount.saturating_sub(amm_output_account.amount);
                if amount_to_split > 0 {
                    conditional_vault::cpi::split_tokens(
                        base_cpi_context,
                        amount_to_split,
                    )?
                }
            }
            SwapType::Sell => {
                let base_mergeable = std::cmp::min(
                    ctx.accounts.amm_fail_base_vault.amount,
                    ctx.accounts.amm_pass_base_vault.amount,
                );

                if base_mergeable > 0 {
                    conditional_vault::cpi::merge_tokens(base_cpi_context, base_mergeable)?
                }
            }
        }

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: amm_output_account.to_account_info(),
                    to: ctx.accounts.user_output_account.to_account_info(),
                    authority: ctx.accounts.futarchy_amm.to_account_info(),
                },
                signer,
            ),
            output_amount,
        )?;

        // ctx.accounts.amm_base_vault.reload()?;
        // ctx.accounts.amm_quote_vault.reload()?;
        // ctx.accounts.amm_pass_base_vault.reload()?;
        // ctx.accounts.amm_pass_quote_vault.reload()?;
        // ctx.accounts.amm_fail_base_vault.reload()?;
        // ctx.accounts.amm_fail_quote_vault.reload()?;

        // msg!("fail base: {}", ctx.accounts.amm_fail_base_vault.amount);
        // msg!("fail quote: {}", ctx.accounts.amm_fail_quote_vault.amount);
        // msg!("pass base: {}", ctx.accounts.amm_pass_base_vault.amount);
        // msg!("pass quote: {}", ctx.accounts.amm_pass_quote_vault.amount);
        // msg!("base: {}", ctx.accounts.amm_base_vault.amount);
        // msg!("quote: {}", ctx.accounts.amm_quote_vault.amount);

        Ok(())
    }
}
