use super::*;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SpotSwapParams {
    pub input_amount: u64,
    pub swap_type: SwapType,
    pub min_output_amount: u64,
}

#[derive(Accounts)]
#[event_cpi]
pub struct SpotSwap<'info> {
    #[account(mut)]
    pub dao: Box<Account<'info, Dao>>,
    // Intentionally using `token::` instead of `associated_token::`
    // DEX integrators may route through non-ATA token accounts.
    #[account(
        mut,
        token::mint = dao.base_mint,
        token::authority = user,
    )]
    pub user_base_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = dao.quote_mint,
        token::authority = user,
    )]
    pub user_quote_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = dao.base_mint,
        associated_token::authority = dao,
    )]
    pub amm_base_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = dao.quote_mint,
        associated_token::authority = dao,
    )]
    pub amm_quote_vault: Box<Account<'info, TokenAccount>>,
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

impl SpotSwap<'_> {
    pub fn handle(ctx: Context<Self>, params: SpotSwapParams) -> Result<()> {
        let SpotSwapParams {
            swap_type,
            input_amount,
            min_output_amount,
        } = params;

        let Self {
            dao,
            user_base_account,
            user_quote_account,
            amm_base_vault,
            amm_quote_vault,
            user,
            token_program,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let (user_input_account, amm_input_account, user_output_account, amm_output_account) =
            match swap_type {
                SwapType::Buy => (
                    user_quote_account,
                    amm_quote_vault,
                    user_base_account,
                    amm_base_vault,
                ),
                SwapType::Sell => (
                    user_base_account,
                    amm_base_vault,
                    user_quote_account,
                    amm_quote_vault,
                ),
            };

        require_gte!(
            user_input_account.amount,
            input_amount,
            FutarchyError::InsufficientBalance
        );

        let output_amount = dao.amm.state.swap(input_amount, swap_type, Market::Spot)?;

        require_gte!(output_amount, min_output_amount);

        token::transfer(
            CpiContext::new(
                token_program.to_account_info(),
                token::Transfer {
                    from: user_input_account.to_account_info(),
                    to: amm_input_account.to_account_info(),
                    authority: user.to_account_info(),
                },
            ),
            input_amount,
        )?;

        // let dao_key = dao.key();
        // let dao_creator = dao.dao_creator;
        // let nonce = dao.nonce;
        // let signer_seeds = &[b"dao".as_ref(), dao_creator.as_ref(), nonce.to_le_bytes().as_ref(), &[dao.pda_bump]];
        let dao_nonce = &dao.nonce.to_le_bytes();
        let dao_creator_key = &dao.dao_creator.as_ref();
        let dao_seeds = &[b"dao".as_ref(), dao_creator_key, dao_nonce, &[dao.pda_bump]];

        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                token::Transfer {
                    from: amm_output_account.to_account_info(),
                    to: user_output_account.to_account_info(),
                    authority: dao.to_account_info(),
                },
                &[&dao_seeds[..]],
            ),
            output_amount,
        )?;

        dao.seq_num += 1;

        let clock = Clock::get()?;

        emit_cpi!(SpotSwapEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            dao: dao.key(),
            user: user.key(),
            swap_type,
            input_amount,
            output_amount,
            min_output_amount,
            post_amm_state: dao.amm.clone(),
        });

        Ok(())
    }
}
