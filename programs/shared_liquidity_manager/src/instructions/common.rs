use anchor_lang::prelude::*;

use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Token, TokenAccount};
use raydium_cpmm_cpi::program::RaydiumCpmm;
use raydium_cpmm_cpi::states::AMM_CONFIG_SEED;

/// Static accounts for initializing a Raydium pool, used as a common struct
/// to reduce code duplication and conserve stack space.
#[derive(Accounts)]
pub struct InitializeRaydiumPoolStaticAccounts<'info> {
    /// CHECK: pool vault and lp mint authority
    #[account(
        seeds = [
            raydium_cpmm_cpi::AUTH_SEED.as_bytes(),
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub raydium_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        address = raydium_cpmm_cpi::create_pool_fee_reveiver::id(),
    )]
    pub create_pool_fee: Box<Account<'info, TokenAccount>>,

    /// CHECK: this is the amm config for the lowest fee pool, can see fees at https://api-v3.raydium.io/main/cpmm-config
    #[account(
        mut,
        seeds = [
            AMM_CONFIG_SEED.as_bytes(),
            &0_u16.to_be_bytes()
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub amm_config: UncheckedAccount<'info>,
    pub cp_swap_program: Program<'info, RaydiumCpmm>,
    pub rent: Sysvar<'info, Rent>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
}
