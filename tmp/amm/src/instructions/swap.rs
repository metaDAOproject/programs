use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};

use crate::error::AmmError;
use crate::generate_amm_seeds;
use crate::state::*;
// use crate::SwapEvent;
use crate::events::{CommonFields, SwapEvent};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SwapArgs {
    pub swap_type: SwapType,
    pub input_amount: u64,
    pub output_amount_min: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub amm: Account<'info, Amm>,
    #[account(
        mut,
        token::mint = amm.base_mint,
        token::authority = user,
    )]
    pub user_base_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = amm.quote_mint,
        token::authority = user,
    )]
    pub user_quote_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = amm.base_mint,
        associated_token::authority = amm,
    )]
    pub vault_ata_base: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = amm.quote_mint,
        associated_token::authority = amm,
    )]
    pub vault_ata_quote: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl Swap<'_> {
    pub fn handle(ctx: Context<Swap>, args: SwapArgs) -> Result<()> {
        let Swap {
            user,
            amm,
            user_base_account,
            user_quote_account,
            vault_ata_base,
            vault_ata_quote,
            token_program,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let SwapArgs {
            swap_type,
            input_amount,
            output_amount_min,
        } = args;

        let clock = Clock::get()?;

        match swap_type {
            SwapType::Buy => require_gte!(
                user_quote_account.amount,
                input_amount,
                AmmError::InsufficientBalance
            ),
            SwapType::Sell => require_gte!(
                user_base_account.amount,
                input_amount,
                AmmError::InsufficientBalance
            ),
        };

        require!(input_amount > 0, AmmError::ZeroSwapAmount);

        amm.update_twap(clock.slot)?;

        let output_amount = amm.swap(input_amount, swap_type)?;

        let seeds = generate_amm_seeds!(amm);

        let (user_from, vault_to, vault_from, user_to) = match swap_type {
            SwapType::Buy => (
                user_quote_account,
                vault_ata_quote,
                vault_ata_base,
                user_base_account,
            ),
            SwapType::Sell => (
                user_base_account,
                vault_ata_base,
                vault_ata_quote,
                user_quote_account,
            ),
        };

        token::transfer(
            CpiContext::new(
                token_program.to_account_info(),
                Transfer {
                    from: user_from.to_account_info(),
                    to: vault_to.to_account_info(),
                    authority: user.to_account_info(),
                },
            ),
            input_amount,
        )?;

        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                Transfer {
                    from: vault_from.to_account_info(),
                    to: user_to.to_account_info(),
                    authority: amm.to_account_info(),
                },
                &[seeds],
            ),
            output_amount,
        )?;

        require_gte!(
            output_amount,
            output_amount_min,
            AmmError::SwapSlippageExceeded
        );

        amm.seq_num += 1;

        emit_cpi!(SwapEvent {
            common: CommonFields::new(&clock, user.key(), amm),
            input_amount,
            output_amount,
            swap_type,
        });

        Ok(())
    }
}
