use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::token_interface;

use crate::error::RelaunchError;
use crate::events::{CommonFields, SellExecutedEvent};
use crate::pump_amm;
use crate::state::{Relaunch, RelaunchState};
use crate::{
    pump_amm_event_authority, pump_amm_fee_config, pump_amm_global_config, pump_amm_program,
    pump_fees_program, usdc_mint,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ExecuteSellArgs {
    /// The admin's live, client-computed slippage floor on the sell proceeds.
    pub min_quote_out: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct ExecuteSell<'info> {
    #[account(
        mut,
        has_one = admin,
        has_one = old_mint,
        has_one = source_quote_mint,
        has_one = source_pool,
        has_one = relaunch_signer,
        has_one = old_token_vault,
        has_one = source_quote_vault,
    )]
    pub relaunch: Box<Account<'info, Relaunch>>,

    pub admin: Signer<'info>,

    /// CHECK: the vault authority that signs the sell; pump_amm requires the
    /// user account writable.
    #[account(mut)]
    pub relaunch_signer: UncheckedAccount<'info>,

    #[account(mint::token_program = base_token_program)]
    pub old_mint: Box<InterfaceAccount<'info, token_interface::Mint>>,

    pub source_quote_mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub old_token_vault: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    #[account(mut)]
    pub source_quote_vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: fingerprint-validated at init and pinned by has_one; pump_amm
    /// rechecks its internal consistency.
    #[account(mut)]
    pub source_pool: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = pump_amm_global_config::id())]
    pub pump_global_config: UncheckedAccount<'info>,

    /// CHECK: pump_amm requires membership in its global config
    pub protocol_fee_recipient: UncheckedAccount<'info>,

    /// CHECK: pump_amm checks this ATA
    #[account(mut)]
    pub protocol_fee_recipient_token_account: UncheckedAccount<'info>,

    /// CHECK: pump_amm checks this against the pool's stored field
    #[account(mut)]
    pub pool_base_token_account: UncheckedAccount<'info>,

    /// CHECK: pump_amm checks this against the pool's stored field
    #[account(mut)]
    pub pool_quote_token_account: UncheckedAccount<'info>,

    /// CHECK: pump_amm derives this from the pool's coin_creator
    #[account(mut)]
    pub coin_creator_vault_ata: UncheckedAccount<'info>,

    /// CHECK: pump_amm derives this from the pool's coin_creator
    pub coin_creator_vault_authority: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = pump_amm_fee_config::id())]
    pub pump_fee_config: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = pump_fees_program::id())]
    pub pump_fee_program: UncheckedAccount<'info>,

    /// CHECK: pump_amm address-checks this PDA (it need not exist)
    pub pool_v2: UncheckedAccount<'info>,

    /// CHECK: pump_amm requires membership in its global config's buyback list
    pub buyback_fee_recipient: UncheckedAccount<'info>,

    /// CHECK: pump_amm checks this ATA
    #[account(mut)]
    pub buyback_fee_recipient_token_account: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = pump_amm_event_authority::id())]
    pub pump_event_authority: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = pump_amm_program::id())]
    pub pump_amm_program: UncheckedAccount<'info>,

    pub base_token_program: Interface<'info, token_interface::TokenInterface>,
    pub quote_token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl ExecuteSell<'_> {
    pub fn validate(&self, _args: &ExecuteSellArgs) -> Result<()> {
        require!(
            self.relaunch.state == RelaunchState::SellPending,
            RelaunchError::RelaunchNotSellPending
        );

        let clock = Clock::get()?;
        require_gte!(
            self.relaunch.unix_timestamp_closed.unwrap()
                + self.relaunch.grace_period_seconds as i64,
            clock.unix_timestamp,
            RelaunchError::GracePeriodElapsed
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: ExecuteSellArgs) -> Result<()> {
        let relaunch_key = ctx.accounts.relaunch.key();

        let seeds = &[
            b"relaunch_signer",
            relaunch_key.as_ref(),
            &[ctx.accounts.relaunch.relaunch_signer_bump],
        ];
        let signer = &[&seeds[..]];

        let base_sold = ctx.accounts.old_token_vault.amount;
        let quote_before = ctx.accounts.source_quote_vault.amount;

        pump_amm::sell(
            pump_amm::Sell {
                pool: ctx.accounts.source_pool.to_account_info(),
                user: ctx.accounts.relaunch_signer.to_account_info(),
                global_config: ctx.accounts.pump_global_config.to_account_info(),
                base_mint: ctx.accounts.old_mint.to_account_info(),
                quote_mint: ctx.accounts.source_quote_mint.to_account_info(),
                user_base_token_account: ctx.accounts.old_token_vault.to_account_info(),
                user_quote_token_account: ctx.accounts.source_quote_vault.to_account_info(),
                pool_base_token_account: ctx.accounts.pool_base_token_account.to_account_info(),
                pool_quote_token_account: ctx.accounts.pool_quote_token_account.to_account_info(),
                protocol_fee_recipient: ctx.accounts.protocol_fee_recipient.to_account_info(),
                protocol_fee_recipient_token_account: ctx
                    .accounts
                    .protocol_fee_recipient_token_account
                    .to_account_info(),
                base_token_program: ctx.accounts.base_token_program.to_account_info(),
                quote_token_program: ctx.accounts.quote_token_program.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
                event_authority: ctx.accounts.pump_event_authority.to_account_info(),
                program: ctx.accounts.pump_amm_program.to_account_info(),
                coin_creator_vault_ata: ctx.accounts.coin_creator_vault_ata.to_account_info(),
                coin_creator_vault_authority: ctx
                    .accounts
                    .coin_creator_vault_authority
                    .to_account_info(),
                fee_config: ctx.accounts.pump_fee_config.to_account_info(),
                fee_program: ctx.accounts.pump_fee_program.to_account_info(),
                pool_v2: ctx.accounts.pool_v2.to_account_info(),
                buyback_fee_recipient: ctx.accounts.buyback_fee_recipient.to_account_info(),
                buyback_fee_recipient_token_account: ctx
                    .accounts
                    .buyback_fee_recipient_token_account
                    .to_account_info(),
            },
            base_sold,
            args.min_quote_out,
            signer,
        )?;

        ctx.accounts.source_quote_vault.reload()?;
        let quote_recovered = ctx.accounts.source_quote_vault.amount - quote_before;

        let relaunch = &mut ctx.accounts.relaunch;
        relaunch.quote_recovered = quote_recovered;
        if relaunch.source_quote_mint == usdc_mint::id() {
            relaunch.usdc_recovered = quote_recovered;
            relaunch.state = RelaunchState::Swapped;
        } else {
            relaunch.state = RelaunchState::Sold;
        }
        relaunch.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(SellExecutedEvent {
            common: CommonFields::new(&clock, ctx.accounts.relaunch.seq_num),
            relaunch: relaunch_key,
            base_sold,
            quote_recovered,
            new_state: ctx.accounts.relaunch.state,
        });

        Ok(())
    }
}
