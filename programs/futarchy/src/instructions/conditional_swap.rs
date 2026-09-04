use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct ConditionalSwapParams {
    pub market: Market,
    pub swap_type: SwapType,
    pub input_amount: u64,
    pub min_output_amount: u64,
}

#[derive(Accounts)]
#[event_cpi]
pub struct ConditionalSwap<'info> {
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(mut, associated_token::mint = dao.base_mint, associated_token::authority = dao)]
    pub amm_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = dao.quote_mint, associated_token::authority = dao)]
    pub amm_quote_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        has_one = dao, has_one = base_vault, has_one = quote_vault,
        has_one = pass_base_mint, has_one = pass_quote_mint,
        has_one = fail_base_mint, has_one = fail_quote_mint,
        has_one = question
    )]
    pub proposal: Box<Account<'info, Proposal>>,

    // These are checked in `validate`
    #[account(mut, associated_token::mint = proposal.pass_base_mint, associated_token::authority = dao)]
    pub amm_pass_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = proposal.pass_quote_mint, associated_token::authority = dao)]
    pub amm_pass_quote_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = proposal.fail_base_mint, associated_token::authority = dao)]
    pub amm_fail_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = proposal.fail_quote_mint, associated_token::authority = dao)]
    pub amm_fail_quote_vault: Box<Account<'info, TokenAccount>>,

    pub trader: Signer<'info>,
    // Intentionally using `token::` instead of `associated_token::`
    // DEX integrators may route through non-ATA token accounts.
    #[account(mut, token::authority = trader)]
    pub user_input_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_output_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub base_vault: Box<Account<'info, ConditionalVault>>,
    #[account(mut, address = base_vault.underlying_token_account)]
    pub base_vault_underlying_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub quote_vault: Box<Account<'info, ConditionalVault>>,
    #[account(mut, address = quote_vault.underlying_token_account)]
    pub quote_vault_underlying_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub pass_base_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub fail_base_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub pass_quote_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub fail_quote_mint: Box<Account<'info, Mint>>,

    pub conditional_vault_program: Program<'info, ConditionalVaultProgram>,
    /// CHECK: checked by conditional vault program
    pub vault_event_authority: UncheckedAccount<'info>,

    pub question: Box<Account<'info, Question>>,

    pub token_program: Program<'info, Token>,
}

impl ConditionalSwap<'_> {
    pub fn validate(&self, params: &ConditionalSwapParams) -> Result<()> {
        require!(self.dao.liquidator.is_none(), FutarchyError::DaoLiquidated);

        require_neq!(params.market, Market::Spot);

        require_gte!(
            self.user_input_account.amount,
            params.input_amount,
            FutarchyError::InsufficientBalance
        );

        require_eq!(
            self.proposal.state,
            ProposalState::Pending,
            FutarchyError::ProposalNotActive
        );
        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: ConditionalSwapParams) -> Result<()> {
        let Self {
            dao,
            amm_base_vault,
            amm_quote_vault,
            proposal,
            amm_pass_base_vault,
            amm_pass_quote_vault,
            amm_fail_base_vault,
            amm_fail_quote_vault,
            trader,
            user_input_account,
            user_output_account,
            base_vault,
            base_vault_underlying_token_account,
            quote_vault,
            quote_vault_underlying_token_account,
            pass_base_mint,
            fail_base_mint,
            pass_quote_mint,
            fail_quote_mint,
            conditional_vault_program,
            vault_event_authority,
            question,
            token_program,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let ConditionalSwapParams {
            market,
            swap_type,
            input_amount,
            min_output_amount,
        } = params;

        let output_amount = dao.amm.state.swap(input_amount, swap_type, market)?;

        require_gte!(
            output_amount,
            min_output_amount,
            FutarchyError::SwapSlippageExceeded
        );

        // You need to transfer in before you can do merges of in
        // You need to do split of out before you can do transfers of out

        let amm_input_account = match (swap_type, market) {
            (SwapType::Buy, Market::Pass) => &amm_pass_quote_vault,
            (SwapType::Sell, Market::Pass) => &amm_pass_base_vault,
            (SwapType::Buy, Market::Fail) => &amm_fail_quote_vault,
            (SwapType::Sell, Market::Fail) => &amm_fail_base_vault,
            (_, Market::Spot) => unreachable!(),
        };

        token::transfer(
            CpiContext::new(
                token_program.to_account_info(),
                token::Transfer {
                    from: user_input_account.to_account_info(),
                    to: amm_input_account.to_account_info(),
                    authority: trader.to_account_info(),
                },
            ),
            input_amount,
        )?;

        // We reload these to ensure that `quote_mergeable` and `base_mergeable` are accurate
        amm_pass_base_vault.reload()?;
        amm_pass_quote_vault.reload()?;
        amm_fail_base_vault.reload()?;
        amm_fail_quote_vault.reload()?;

        let dao_creator = dao.dao_creator;
        let nonce = dao.nonce.to_le_bytes();
        let signer_seeds = &[
            SEED_DAO,
            dao_creator.as_ref(),
            nonce.as_ref(),
            &[dao.pda_bump],
        ];
        let signer = &[&signer_seeds[..]];

        let quote_cpi_context = CpiContext::new_with_signer(
            conditional_vault_program.to_account_info(),
            conditional_vault::cpi::accounts::InteractWithVault {
                question: question.to_account_info(),
                vault: quote_vault.to_account_info(),
                vault_underlying_token_account: quote_vault_underlying_token_account
                    .to_account_info(),
                authority: dao.to_account_info(),
                user_underlying_token_account: amm_quote_vault.to_account_info(),
                event_authority: vault_event_authority.to_account_info(),
                program: conditional_vault_program.to_account_info(),
                token_program: token_program.to_account_info(),
            },
            signer,
        )
        .with_remaining_accounts(vec![
            fail_quote_mint.to_account_info(),
            pass_quote_mint.to_account_info(),
            amm_fail_quote_vault.to_account_info(),
            amm_pass_quote_vault.to_account_info(),
        ]);

        let amm_output_account = match (swap_type, market) {
            (SwapType::Buy, Market::Pass) => &amm_pass_base_vault,
            (SwapType::Sell, Market::Pass) => &amm_pass_quote_vault,
            (SwapType::Buy, Market::Fail) => &amm_fail_base_vault,
            (SwapType::Sell, Market::Fail) => &amm_fail_quote_vault,
            (_, Market::Spot) => unreachable!(),
        };

        // If the user is buying, we should have just received some quote to merge
        // If they're selling, we might need to split some quote
        match swap_type {
            SwapType::Buy => {
                let quote_mergeable =
                    std::cmp::min(amm_fail_quote_vault.amount, amm_pass_quote_vault.amount);

                if quote_mergeable > 0 {
                    conditional_vault::cpi::merge_tokens(quote_cpi_context, quote_mergeable)?
                }
            }
            SwapType::Sell => {
                let amount_to_split = output_amount.saturating_sub(amm_output_account.amount);

                if amount_to_split > 0 {
                    conditional_vault::cpi::split_tokens(quote_cpi_context, amount_to_split)?
                }
            }
        }

        let base_cpi_context = CpiContext::new_with_signer(
            conditional_vault_program.to_account_info(),
            conditional_vault::cpi::accounts::InteractWithVault {
                question: question.to_account_info(),
                vault: base_vault.to_account_info(),
                vault_underlying_token_account: base_vault_underlying_token_account
                    .to_account_info(),
                authority: dao.to_account_info(),
                user_underlying_token_account: amm_base_vault.to_account_info(),
                event_authority: vault_event_authority.to_account_info(),
                program: conditional_vault_program.to_account_info(),
                token_program: token_program.to_account_info(),
            },
            signer,
        )
        .with_remaining_accounts(vec![
            fail_base_mint.to_account_info(),
            pass_base_mint.to_account_info(),
            amm_fail_base_vault.to_account_info(),
            amm_pass_base_vault.to_account_info(),
        ]);

        match swap_type {
            SwapType::Buy => {
                let amount_to_split = output_amount.saturating_sub(amm_output_account.amount);

                if amount_to_split > 0 {
                    conditional_vault::cpi::split_tokens(base_cpi_context, amount_to_split)?
                }
            }
            SwapType::Sell => {
                let base_mergeable =
                    std::cmp::min(amm_fail_base_vault.amount, amm_pass_base_vault.amount);

                if base_mergeable > 0 {
                    conditional_vault::cpi::merge_tokens(base_cpi_context, base_mergeable)?
                }
            }
        }

        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                token::Transfer {
                    from: amm_output_account.to_account_info(),
                    to: user_output_account.to_account_info(),
                    authority: dao.to_account_info(),
                },
                signer,
            ),
            output_amount,
        )?;

        let clock = Clock::get()?;

        dao.seq_num += 1;

        emit_cpi!(ConditionalSwapEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            dao: dao.key(),
            proposal: proposal.key(),
            trader: trader.key(),
            market,
            swap_type,
            input_amount,
            output_amount,
            min_output_amount,
            post_amm_state: dao.amm.clone(),
        });

        Ok(())
    }
}
