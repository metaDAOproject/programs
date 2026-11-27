use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

use crate::{
    error::LiquidationError,
    events::{CommonFields, LiquidationExtendedEvent},
    state::{Liquidation, SEED_LIQUIDATION},
};

mod admin {
    use anchor_lang::solana_program::pubkey::declare_id;

    // MetaDAO operational multisig
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AdminExtendLiquidationArgs {
    pub new_duration_seconds: u32,
}

#[event_cpi]
#[derive(Accounts)]
pub struct AdminExtendLiquidation<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        has_one = quote_mint @ LiquidationError::InvalidMint,
        seeds = [SEED_LIQUIDATION, liquidation.base_mint.as_ref(), quote_mint.key().as_ref(), liquidation.create_key.as_ref()],
        bump = liquidation.pda_bump,
    )]
    pub liquidation: Account<'info, Liquidation>,

    #[account(
        associated_token::mint = quote_mint,
        associated_token::authority = liquidation,
    )]
    pub liquidation_quote_vault: Account<'info, TokenAccount>,

    pub quote_mint: Account<'info, Mint>,
}

impl AdminExtendLiquidation<'_> {
    pub fn validate(&self, args: &AdminExtendLiquidationArgs) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(self.admin.key(), admin::ID, LiquidationError::InvalidAdmin);

        require!(
            self.liquidation.is_refunding,
            LiquidationError::RefundingNotEnabled
        );

        // The refund window can only grow
        require_gt!(
            args.new_duration_seconds,
            self.liquidation.duration_seconds,
            LiquidationError::DurationNotIncreased
        );

        // The vault must still cover every unpaid refund
        require_gte!(
            self.liquidation_quote_vault.amount,
            self.liquidation.total_quote_refundable - self.liquidation.total_quote_refunded,
            LiquidationError::VaultUnderfunded
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: AdminExtendLiquidationArgs) -> Result<()> {
        let clock = Clock::get()?;
        let liquidation = &mut ctx.accounts.liquidation;

        let old_duration_seconds = liquidation.duration_seconds;
        liquidation.duration_seconds = args.new_duration_seconds;

        // Emit event
        liquidation.seq_num += 1;

        emit_cpi!(LiquidationExtendedEvent {
            common: CommonFields::new(&clock, liquidation.seq_num),
            liquidation: liquidation.key(),
            old_duration_seconds,
            new_duration_seconds: liquidation.duration_seconds,
        });

        Ok(())
    }
}
