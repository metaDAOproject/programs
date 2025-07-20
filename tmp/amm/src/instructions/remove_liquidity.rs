use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Transfer};

use crate::{error::AmmError, *};

use crate::events::RemoveLiquidityEvent;

#[derive(Debug, Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct RemoveLiquidityArgs {
    pub lp_tokens_to_burn: u64,
    pub min_quote_amount: u64,
    pub min_base_amount: u64,
}

impl AddOrRemoveLiquidity<'_> {
    pub fn handle_remove(
        ctx: Context<AddOrRemoveLiquidity>,
        args: RemoveLiquidityArgs,
    ) -> Result<()> {
        let AddOrRemoveLiquidity {
            user,
            amm,
            lp_mint,
            user_lp_account,
            user_base_account,
            user_quote_account,
            vault_ata_base,
            vault_ata_quote,
            token_program,
            program: _,
            event_authority: _,
        } = ctx.accounts;

        let RemoveLiquidityArgs {
            lp_tokens_to_burn,
            min_quote_amount,
            min_base_amount,
        } = args;

        require_gte!(
            user_lp_account.amount,
            lp_tokens_to_burn,
            AmmError::InsufficientBalance
        );

        require!(lp_tokens_to_burn > 0, AmmError::ZeroLiquidityRemove);

        amm.update_twap(Clock::get()?.slot)?;

        // airlifted from uniswap v1:
        // https://github.com/Uniswap/v1-contracts/blob/c10c08d81d6114f694baa8bd32f555a40f6264da/contracts/uniswap_exchange.vy#L83

        let total_liquidity = lp_mint.supply;
        require_gt!(total_liquidity, 0, AmmError::AssertFailed);

        let (base_to_withdraw, quote_to_withdraw) =
            amm.get_base_and_quote_withdrawable(lp_tokens_to_burn, total_liquidity);

        require_gte!(
            base_to_withdraw,
            min_base_amount,
            AmmError::SwapSlippageExceeded
        );
        require_gte!(
            quote_to_withdraw,
            min_quote_amount,
            AmmError::SwapSlippageExceeded
        );

        token::burn(
            CpiContext::new(
                token_program.to_account_info(),
                Burn {
                    mint: lp_mint.to_account_info(),
                    from: user_lp_account.to_account_info(),
                    authority: user.to_account_info(),
                },
            ),
            lp_tokens_to_burn,
        )?;

        amm.base_amount -= base_to_withdraw;
        amm.quote_amount -= quote_to_withdraw;

        let seeds = generate_amm_seeds!(amm);

        for (amount_to_withdraw, from, to) in [
            (base_to_withdraw, vault_ata_base, user_base_account),
            (quote_to_withdraw, vault_ata_quote, user_quote_account),
        ] {
            token::transfer(
                CpiContext::new_with_signer(
                    token_program.to_account_info(),
                    Transfer {
                        from: from.to_account_info(),
                        to: to.to_account_info(),
                        authority: amm.to_account_info(),
                    },
                    &[seeds],
                ),
                amount_to_withdraw,
            )?;
        }

        amm.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(RemoveLiquidityEvent {
            common: CommonFields::new(&clock, user.key(), amm),
            lp_tokens_burned: lp_tokens_to_burn,
            min_quote_amount,
            min_base_amount,
            base_amount: base_to_withdraw,
            quote_amount: quote_to_withdraw,
        });

        Ok(())
    }
}
