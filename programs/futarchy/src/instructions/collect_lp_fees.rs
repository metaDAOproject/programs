use super::*;

pub mod admin {
    use anchor_lang::prelude::declare_id;

    // MetaDAO multisig
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct CollectLpFeesArgs {
    pub target_k: u128,
}

#[derive(Accounts)]
#[event_cpi]
pub struct CollectLpFees<'info> {
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

impl CollectLpFees<'_> {
    pub fn validate(&self, args: &CollectLpFeesArgs) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(self.admin.key(), admin::ID, FutarchyError::InvalidAdmin);

        if let PoolState::Spot { ref spot } = self.dao.amm.state {
            require_gt!(spot.k(), args.target_k, FutarchyError::InvalidTargetK);
        } else {
            return err!(FutarchyError::PoolNotInSpotState);
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, _args: CollectLpFeesArgs) -> Result<()> {
        // TODO: implement LP fee collection logic
        // We have two formulas:
        // 1. Liquidity: K = x * y
        // 2. Price: P = y / x
        // In both cases x is the base reserves and y is the quote reserves
        // We need to calculate the new reserves x' and y' that would result in the target K'
        // while maintaining the price P = y / x = y' / x'

        Ok(())
    }
}
