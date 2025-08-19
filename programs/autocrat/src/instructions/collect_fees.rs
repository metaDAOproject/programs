use super::*;

use anchor_spl::token::{self, Transfer};

// declare_id!()
pub mod admin {
    use anchor_lang::prelude::declare_id;

    declare_id!("613BRiXuAEn7vibs2oAYzpGW9fXgjzDNuFMM4wPzLdY");
}


#[derive(Accounts)]
pub struct CollectFees<'info> {
    #[account(mut)]
    pub dao: Account<'info, Dao>,
    pub admin: Signer<'info>,
    #[account(mut, token::mint = dao.base_mint)]
    pub base_receiver: Account<'info, TokenAccount>,
    #[account(mut, token::mint = dao.quote_mint)]
    pub quote_receiver: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    #[account(mut, associated_token::mint = dao.base_mint, associated_token::authority = dao)]
    pub amm_base_vault: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = dao.quote_mint, associated_token::authority = dao)]
    pub amm_quote_vault: Account<'info, TokenAccount>,
}

impl CollectFees<'_> {
    pub fn validate(ctx: &Context<Self>) -> Result<()> {
        require_keys_eq!(ctx.accounts.admin.key(), admin::ID, AutocratError::InvalidAdmin);
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let Self {
            dao,
            admin: _,
            base_receiver,
            quote_receiver,
            amm_base_vault,
            amm_quote_vault,
            token_program,
        } = ctx.accounts;

        let PoolState::Spot { ref mut spot } = dao.futarchy_amm.state else {
            // TODO: check that pool is already in right state
            unreachable!();
        };

        let base_fee_balance = spot.base_protocol_fee_balance;
        let quote_fee_balance = spot.quote_protocol_fee_balance;

        spot.base_protocol_fee_balance = 0;
        spot.quote_protocol_fee_balance = 0;

        // Transfer tokens from AMM vaults to user
        let dao_key = dao.key();
        let signer_seeds = &[b"dao".as_ref(), dao_key.as_ref(), &[dao.pda_bump]];

        for (amount_to_send, from, to) in [
            (base_fee_balance, amm_base_vault, base_receiver),
            (quote_fee_balance, amm_quote_vault, quote_receiver),
        ] {
            token::transfer(
                CpiContext::new_with_signer(
                    token_program.to_account_info(),
                    Transfer {
                        from: from.to_account_info(),
                        to: to.to_account_info(),
                        authority: dao.to_account_info(),
                    },
                    &[&signer_seeds[..]],
                ),
                amount_to_send,
            )?;
        }

        Ok(())
    }
} 