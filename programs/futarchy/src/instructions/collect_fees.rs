use super::*;

pub mod admin {
    use anchor_lang::prelude::declare_id;

    // MetaDAO multisig
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

#[derive(Accounts)]
pub struct CollectFees<'info> {
    #[account(mut)]
    pub dao: Account<'info, Dao>,
    pub admin: Signer<'info>,
    #[account(mut, token::mint = dao.base_mint)]
    pub base_token_account: Account<'info, TokenAccount>,
    #[account(mut, token::mint = dao.quote_mint)]
    pub quote_token_account: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = dao.base_mint, associated_token::authority = dao)]
    pub amm_base_vault: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = dao.quote_mint, associated_token::authority = dao)]
    pub amm_quote_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl CollectFees<'_> {
    pub fn validate(&self) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(self.admin.key(), admin::ID, AutocratError::InvalidAdmin);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let Self {
            dao,
            admin: _,
            base_token_account,
            quote_token_account,
            amm_base_vault,
            amm_quote_vault,
            token_program,
        } = ctx.accounts;

        let PoolState::Spot { ref mut spot } = dao.amm.state else {
            return err!(AutocratError::PoolNotInSpotState);
        };

        let base_fee_balance = spot.base_protocol_fee_balance;
        let quote_fee_balance = spot.quote_protocol_fee_balance;

        spot.base_protocol_fee_balance = 0;
        spot.quote_protocol_fee_balance = 0;

        let dao_creator = dao.dao_creator;
        let nonce = dao.nonce.to_le_bytes();
        let signer_seeds = &[
            b"dao".as_ref(),
            dao_creator.as_ref(),
            nonce.as_ref(),
            &[dao.pda_bump],
        ];

        for (amount_to_send, from, to) in [
            (base_fee_balance, amm_base_vault, base_token_account),
            (quote_fee_balance, amm_quote_vault, quote_token_account),
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
