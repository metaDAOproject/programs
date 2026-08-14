use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::error::RelaunchError;
use crate::events::{CommonFields, UsdcSwapExecutedEvent};
use crate::state::{Relaunch, RelaunchState};
use crate::whirlpool;
use crate::{memo_program, usdc_mint, usdc_swap_pool, whirlpool_program, wsol_mint};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ExecuteUsdcSwapArgs {
    /// The admin's live, client-computed slippage floor on the swap output.
    pub min_usdc_out: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct ExecuteUsdcSwap<'info> {
    #[account(
        mut,
        has_one = admin,
        has_one = relaunch_signer,
        has_one = source_quote_vault,
        has_one = usdc_vault,
    )]
    pub relaunch: Box<Account<'info, Relaunch>>,

    pub admin: Signer<'info>,

    /// CHECK: the vault authority that signs the swap.
    pub relaunch_signer: UncheckedAccount<'info>,

    /// The WSOL vault holding the sell proceeds; `Sold` only occurs for
    /// WSOL-quoted sources.
    #[account(mut)]
    pub source_quote_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub usdc_vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: pinned to the program's swap-venue constant; whirlpool rechecks
    /// its internal consistency.
    #[account(mut, address = usdc_swap_pool::id())]
    pub whirlpool: UncheckedAccount<'info>,

    /// CHECK: fixed address; the pinned pool's token A.
    #[account(address = wsol_mint::id())]
    pub wsol_mint: UncheckedAccount<'info>,

    /// CHECK: fixed address; the pinned pool's token B.
    #[account(address = usdc_mint::id())]
    pub usdc_mint: UncheckedAccount<'info>,

    /// CHECK: whirlpool checks this against the pool's stored field
    #[account(mut)]
    pub whirlpool_wsol_vault: UncheckedAccount<'info>,

    /// CHECK: whirlpool checks this against the pool's stored field
    #[account(mut)]
    pub whirlpool_usdc_vault: UncheckedAccount<'info>,

    /// CHECK: whirlpool validates the tick-array sequence
    #[account(mut)]
    pub tick_array_0: UncheckedAccount<'info>,

    /// CHECK: whirlpool validates the tick-array sequence
    #[account(mut)]
    pub tick_array_1: UncheckedAccount<'info>,

    /// CHECK: whirlpool validates the tick-array sequence
    #[account(mut)]
    pub tick_array_2: UncheckedAccount<'info>,

    /// CHECK: whirlpool checks this PDA
    #[account(mut)]
    pub oracle: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = memo_program::id())]
    pub memo_program: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = whirlpool_program::id())]
    pub whirlpool_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

impl ExecuteUsdcSwap<'_> {
    pub fn validate(&self, _args: &ExecuteUsdcSwapArgs) -> Result<()> {
        require!(
            self.relaunch.state == RelaunchState::Sold,
            RelaunchError::RelaunchNotSold
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: ExecuteUsdcSwapArgs) -> Result<()> {
        let relaunch_key = ctx.accounts.relaunch.key();

        let seeds = &[
            b"relaunch_signer",
            relaunch_key.as_ref(),
            &[ctx.accounts.relaunch.relaunch_signer_bump],
        ];
        let signer = &[&seeds[..]];

        let wsol_sold = ctx.accounts.source_quote_vault.amount;
        let usdc_before = ctx.accounts.usdc_vault.amount;

        whirlpool::swap_v2(
            whirlpool::SwapV2 {
                token_program_a: ctx.accounts.token_program.to_account_info(),
                token_program_b: ctx.accounts.token_program.to_account_info(),
                memo_program: ctx.accounts.memo_program.to_account_info(),
                token_authority: ctx.accounts.relaunch_signer.to_account_info(),
                whirlpool: ctx.accounts.whirlpool.to_account_info(),
                token_mint_a: ctx.accounts.wsol_mint.to_account_info(),
                token_mint_b: ctx.accounts.usdc_mint.to_account_info(),
                token_owner_account_a: ctx.accounts.source_quote_vault.to_account_info(),
                token_vault_a: ctx.accounts.whirlpool_wsol_vault.to_account_info(),
                token_owner_account_b: ctx.accounts.usdc_vault.to_account_info(),
                token_vault_b: ctx.accounts.whirlpool_usdc_vault.to_account_info(),
                tick_array_0: ctx.accounts.tick_array_0.to_account_info(),
                tick_array_1: ctx.accounts.tick_array_1.to_account_info(),
                tick_array_2: ctx.accounts.tick_array_2.to_account_info(),
                oracle: ctx.accounts.oracle.to_account_info(),
            },
            wsol_sold,
            args.min_usdc_out,
            whirlpool::MIN_SQRT_PRICE,
            true, // amount specified is input
            true, // a→b: WSOL → USDC
            signer,
        )?;

        ctx.accounts.usdc_vault.reload()?;
        let usdc_recovered = ctx.accounts.usdc_vault.amount - usdc_before;

        // Whirlpool enforces min_usdc_out internally; re-check the measured
        // delta so the floor doesn't rest on the external program.
        require_gte!(
            usdc_recovered,
            args.min_usdc_out,
            RelaunchError::SlippageExceeded
        );

        let relaunch = &mut ctx.accounts.relaunch;
        relaunch.usdc_recovered = usdc_recovered;
        relaunch.state = RelaunchState::Swapped;
        relaunch.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(UsdcSwapExecutedEvent {
            common: CommonFields::new(&clock, ctx.accounts.relaunch.seq_num),
            relaunch: relaunch_key,
            wsol_sold,
            usdc_recovered,
        });

        Ok(())
    }
}
