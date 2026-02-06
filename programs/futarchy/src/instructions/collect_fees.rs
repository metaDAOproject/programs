use super::*;

pub mod metadao_multisig_vault {
    use anchor_lang::prelude::declare_id;

    // MetaDAO operations multisig vault - hardcoded fee destination
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

pub mod metadao_admin {
    use anchor_lang::prelude::declare_id;

    declare_id!("tSTp6B6kE9o6ZaTmHm2ZwnJBBtgd3x112tapxFhmBEQ");
}

#[derive(Accounts)]
#[event_cpi]
pub struct CollectFees<'info> {
    #[account(mut)]
    pub dao: Account<'info, Dao>,
    pub admin: Signer<'info>,
    #[account(mut, associated_token::mint = dao.base_mint, associated_token::authority = metadao_multisig_vault::ID)]
    pub base_token_account: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = dao.quote_mint, associated_token::authority = metadao_multisig_vault::ID)]
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
        require_keys_eq!(
            self.admin.key(),
            metadao_admin::ID,
            FutarchyError::InvalidAdmin
        );

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
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let PoolState::Spot { ref mut spot } = dao.amm.state else {
            return err!(FutarchyError::PoolNotInSpotState);
        };

        let base_fee_balance = spot.base_protocol_fee_balance;
        let quote_fee_balance = spot.quote_protocol_fee_balance;

        spot.base_protocol_fee_balance = 0;
        spot.quote_protocol_fee_balance = 0;

        let dao_creator = dao.dao_creator;
        let nonce = dao.nonce.to_le_bytes();
        let signer_seeds = &[
            SEED_DAO,
            dao_creator.as_ref(),
            nonce.as_ref(),
            &[dao.pda_bump],
        ];

        for (amount_to_send, from, to) in [
            (base_fee_balance, &amm_base_vault, &base_token_account),
            (quote_fee_balance, &amm_quote_vault, &quote_token_account),
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

        let clock = Clock::get()?;

        dao.seq_num += 1;

        emit_cpi!(CollectFeesEvent {
            common: CommonFields::new(&clock, dao.seq_num),
            dao: dao.key(),
            base_token_account: base_token_account.key(),
            quote_token_account: quote_token_account.key(),
            amm_base_vault: amm_base_vault.key(),
            amm_quote_vault: amm_quote_vault.key(),
            quote_mint: dao.quote_mint,
            base_mint: dao.base_mint,
            quote_fees_collected: quote_fee_balance,
            base_fees_collected: base_fee_balance,
            post_amm_state: dao.amm.clone(),
        });

        Ok(())
    }
}
