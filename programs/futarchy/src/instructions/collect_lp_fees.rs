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

    pub fn handle(ctx: Context<Self>, args: CollectLpFeesArgs) -> Result<()> {
        // Take accrued liquidity as fees while maintaining the price
        //
        // We have two constraints:
        // 1. Liquidity:
        //    Current: K = x * y
        //    Target:  K' = x' * y'
        //
        // 2. Price: P = y / x = y' / x' <- price remains the same
        //
        // x is the base reserves and y is the quote reserves.
        //
        // We need to calculate the target reserves x' and y' that would result
        // in the target liquidity K' while maintaining the price P = y / x = y' / x'
        //
        // If we substitute constraint 2 into constraint 1, we get:
        //
        //    K' = x' * (P * x')
        //    K' = P * x'^2
        //    x'^2 = K' / P
        //    x' = sqrt(K' / P)
        //
        //    y' = P * x' = P * sqrt(K' / P) = sqrt(P^2 * K' / P) = sqrt(P * K')
        //
        // Since P = y / x, we can substitute P into the formulas to get:
        //
        //    x' = sqrt(K' / (y/x)) = sqrt(K' * x / y)
        //    y' = sqrt(K' * (y/x)) = sqrt(K' * y / x)
        //
        // Using K = x * y (thus y = K / x and x = K / y), we can express the formulas as:
        //
        //    x' = sqrt(K' * x / y) = sqrt(K' / K * x^2) = x * sqrt(K' / K)
        //    y' = sqrt(K' * y / x) = sqrt(K' / K * y^2) = y * sqrt(K' / K)
        //
        // Therefore, we can calculate the target reserves x' and y' as:
        //
        //    x' = x * sqrt(K') / sqrt(K)
        //    y' = y * sqrt(K') / sqrt(K)
        //
        // The amount of fees to collect is then:
        //
        //    base_fees = x - x'
        //    quote_fees = y - y'

        let PoolState::Spot { ref mut spot } = ctx.accounts.dao.amm.state else {
            return err!(FutarchyError::PoolNotInSpotState);
        };

        let sqrt_k = sqrt_u128(spot.k(), false);
        let sqrt_target_k = sqrt_u128(args.target_k, true);

        let target_base_reserves = (spot.base_reserves as u128 * sqrt_target_k / sqrt_k) as u64;
        let target_quote_reserves = (spot.quote_reserves as u128 * sqrt_target_k / sqrt_k) as u64;

        let base_fees = spot.base_reserves - target_base_reserves;
        let quote_fees = spot.quote_reserves - target_quote_reserves;

        spot.base_reserves = target_base_reserves;
        spot.quote_reserves = target_quote_reserves;

        let dao_creator = ctx.accounts.dao.dao_creator;
        let nonce = ctx.accounts.dao.nonce.to_le_bytes();
        let dao_seeds = &[
            b"dao".as_ref(),
            dao_creator.as_ref(),
            nonce.as_ref(),
            &[ctx.accounts.dao.pda_bump],
        ];
        let dao_signer = &[&dao_seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.amm_base_vault.to_account_info(),
                    to: ctx.accounts.base_token_account.to_account_info(),
                    authority: ctx.accounts.dao.to_account_info(),
                },
                dao_signer,
            ),
            base_fees,
        )?;

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.amm_quote_vault.to_account_info(),
                    to: ctx.accounts.quote_token_account.to_account_info(),
                    authority: ctx.accounts.dao.to_account_info(),
                },
                dao_signer,
            ),
            quote_fees,
        )?;

        Ok(())
    }
}

/// Integer square root using Newton's method
/// Returns floor(sqrt(n))
fn sqrt_u128(n: u128, ceil: bool) -> u128 {
    if n == 0 {
        return 0;
    }

    let mut x = n;
    let mut y = (x + 1) >> 1;

    while y < x {
        x = y;
        y = (x + n / x) >> 1;
    }

    // x is floor(sqrt(n))
    // If x² == n exactly, ceil equals floor
    // Otherwise, ceil = floor + 1
    if ceil {
        if x * x == n {
            x
        } else {
            x + 1
        }
    } else {
        x
    }
}
