use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::error::RelaunchError;
use crate::events::{CommonFields, SellExecutedEvent};
use crate::raydium_amm;
use crate::state::{Relaunch, RelaunchState, SourceVenue};
use crate::{raydium_amm_authority, raydium_amm_program};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ExecuteSellRaydiumArgs {
    /// The admin's live, client-computed slippage floor on the sell proceeds.
    pub min_quote_out: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct ExecuteSellRaydium<'info> {
    #[account(
        mut,
        has_one = admin,
        has_one = source_pool,
        has_one = relaunch_signer,
        has_one = old_token_vault,
        has_one = source_quote_vault,
    )]
    pub relaunch: Box<Account<'info, Relaunch>>,

    pub admin: Signer<'info>,

    /// CHECK: the vault authority that signs the sell
    pub relaunch_signer: UncheckedAccount<'info>,

    #[account(mut)]
    pub old_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub source_quote_vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: fingerprint-validated at init and pinned by has_one; the AMM
    /// rechecks its internal consistency.
    #[account(mut)]
    pub source_pool: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = raydium_amm_authority::id())]
    pub amm_authority: UncheckedAccount<'info>,

    /// CHECK: pinned against the pool's stored field in validate()
    #[account(mut)]
    pub amm_coin_vault: UncheckedAccount<'info>,

    /// CHECK: pinned against the pool's stored field in validate()
    #[account(mut)]
    pub amm_pc_vault: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = raydium_amm_program::id())]
    pub raydium_amm_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

impl ExecuteSellRaydium<'_> {
    pub fn validate(&self, _args: &ExecuteSellRaydiumArgs) -> Result<()> {
        require!(
            self.relaunch.state == RelaunchState::SellPending,
            RelaunchError::RelaunchNotSellPending
        );

        require!(
            self.relaunch.source_venue == SourceVenue::RaydiumAmmV4,
            RelaunchError::WrongSourceVenue
        );

        let clock = Clock::get()?;
        require_gte!(
            self.relaunch.unix_timestamp_closed.unwrap()
                + self.relaunch.grace_period_seconds as i64,
            clock.unix_timestamp,
            RelaunchError::GracePeriodElapsed
        );

        // Pin the vaults to the pool's stored fields.
        let pool = raydium_amm::RaydiumPool::try_parse(&self.source_pool.try_borrow_data()?)?;
        require_keys_eq!(
            self.amm_coin_vault.key(),
            pool.coin_vault,
            RelaunchError::SourcePoolNotCanonical
        );
        require_keys_eq!(
            self.amm_pc_vault.key(),
            pool.pc_vault,
            RelaunchError::SourcePoolNotCanonical
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: ExecuteSellRaydiumArgs) -> Result<()> {
        let relaunch_key = ctx.accounts.relaunch.key();

        let seeds = &[
            b"relaunch_signer",
            relaunch_key.as_ref(),
            &[ctx.accounts.relaunch.relaunch_signer_bump],
        ];
        let signer = &[&seeds[..]];

        let base_sold = ctx.accounts.old_token_vault.amount;
        let quote_before = ctx.accounts.source_quote_vault.amount;

        raydium_amm::swap_base_in_v2(
            raydium_amm::Swap {
                token_program: ctx.accounts.token_program.to_account_info(),
                amm: ctx.accounts.source_pool.to_account_info(),
                amm_authority: ctx.accounts.amm_authority.to_account_info(),
                amm_coin_vault: ctx.accounts.amm_coin_vault.to_account_info(),
                amm_pc_vault: ctx.accounts.amm_pc_vault.to_account_info(),
                user_source_token_account: ctx.accounts.old_token_vault.to_account_info(),
                user_destination_token_account: ctx
                    .accounts
                    .source_quote_vault
                    .to_account_info(),
                user_source_owner: ctx.accounts.relaunch_signer.to_account_info(),
            },
            base_sold,
            args.min_quote_out,
            signer,
        )?;

        ctx.accounts.source_quote_vault.reload()?;
        let quote_recovered = ctx.accounts.source_quote_vault.amount - quote_before;

        // Raydium sources are WSOL-quoted, so the sell always lands in Sold.
        let relaunch = &mut ctx.accounts.relaunch;
        relaunch.quote_recovered = quote_recovered;
        relaunch.state = RelaunchState::Sold;
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
