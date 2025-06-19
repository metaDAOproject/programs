//! Initializes a shared liquidity pool.
//! 
//! The pool creator provides the initial liquidity and can't
//! be frontrun 
use anchor_lang::prelude::*;
use anchor_lang::Discriminator;
use anchor_spl::associated_token;

use crate::state::SharedLiquidityPool;

use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::get_associated_token_address;

use autocrat::state::Dao;
use raydium_cpmm_cpi::{
    cpi, instruction,
    program::RaydiumCpmm,
    states::{AmmConfig, OBSERVATION_SEED, POOL_LP_MINT_SEED, POOL_VAULT_SEED, AMM_CONFIG_SEED},
};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeSharedLiquidityPoolParams {
    pub base_amount: u64,
    pub quote_amount: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct InitializeSharedLiquidityPool<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + std::mem::size_of::<SharedLiquidityPool>(),
        seeds = [b"sl_pool", dao.key().as_ref(), creator.key().as_ref()],
        bump
    )]
    pub sl_pool: Box<Account<'info, SharedLiquidityPool>>,
    pub dao: Box<Account<'info, Dao>>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub base_mint: Box<Account<'info, Mint>>,
    pub quote_mint: Box<Account<'info, Mint>>,

    /// CHECK: this is the shared liquidity pool's lp vault, we initialize it post initializing the spot pool
    #[account(mut, address = get_associated_token_address(sl_pool_signer.key, spot_pool_lp_mint.key))]
    pub sl_pool_spot_lp_vault: UncheckedAccount<'info>,

    #[account(
        mut,
        token::mint = quote_mint,
        token::authority = creator,
    )]
    pub creator_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = base_mint,
        token::authority = creator,
    )]
    pub creator_base_token_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: this can't be initialized because the lp mint is not created yet,
    ///        so Raydium will create it
    #[account(
        mut,
        address = get_associated_token_address(
            creator.key,
            spot_pool_lp_mint.key,
        )
    )]
    pub creator_lp_account: UncheckedAccount<'info>,

    /// CHECK: pool vault and lp mint authority
    #[account(
        seeds = [
            raydium_cpmm_cpi::AUTH_SEED.as_bytes(),
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub raydium_authority: UncheckedAccount<'info>,

    /// Use the lowest fee pool, can see fees at https://api-v3.raydium.io/main/cpmm-config
    #[account(
        mut,
        seeds = [
            AMM_CONFIG_SEED.as_bytes(),
            &0_u16.to_be_bytes()
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub amm_config: Box<Account<'info, AmmConfig>>,

    /// CHECK: this is the first spot pool, init by cp-swap, we use 0 in the seed to indicate it's the first spot pool
    #[account(
        mut,
        seeds = [
            b"spot_pool",
            &0_u32.to_le_bytes()
        ],
        bump,
    )]
    pub spot_pool: UncheckedAccount<'info>,

    /// CHECK: pool lp mint, init by cp-swap
    #[account(
        mut,
        seeds = [
            POOL_LP_MINT_SEED.as_bytes(),
            spot_pool.key().as_ref(),
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub spot_pool_lp_mint: UncheckedAccount<'info>,

    /// CHECK: Base vault for the spot pool, init by cp-swap
    #[account(
        mut,
        seeds = [
            POOL_VAULT_SEED.as_bytes(),
            spot_pool.key().as_ref(),
            base_mint.key().as_ref()
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub spot_pool_base_vault: UncheckedAccount<'info>,

    /// CHECK: Quote vault for the spot pool, init by cp-swap
    #[account(
        mut,
        seeds = [
            POOL_VAULT_SEED.as_bytes(),
            spot_pool.key().as_ref(),
            quote_mint.key().as_ref()
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub spot_pool_quote_vault: UncheckedAccount<'info>,

    /// create pool fee account
    #[account(
        mut,
        address = raydium_cpmm_cpi::create_pool_fee_reveiver::id(),
    )]
    pub create_pool_fee: Box<Account<'info, TokenAccount>>,

    /// CHECK: an account to store oracle observations, init by cp-swap
    #[account(
        mut,
        seeds = [
            OBSERVATION_SEED.as_bytes(),
            spot_pool.key().as_ref(),
        ],
        seeds::program = cp_swap_program,
        bump,
    )]
    pub spot_pool_observation_state: UncheckedAccount<'info>,

    /// CHECK: This is the shared liquidity pool signer
    #[account(
        seeds = [b"sl_pool_signer", sl_pool.key().as_ref()],
        bump
    )]
    pub sl_pool_signer: UncheckedAccount<'info>,

    // We don't need the following two accounts, but nice to verify that they are created
    #[account(
        associated_token::mint = base_mint,
        associated_token::authority = sl_pool_signer,
    )]
    pub sl_pool_base_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        associated_token::mint = quote_mint,
        associated_token::authority = sl_pool_signer,
    )]
    pub sl_pool_quote_vault: Box<Account<'info, TokenAccount>>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub cp_swap_program: Program<'info, RaydiumCpmm>,
    pub rent: Sysvar<'info, Rent>,
}

impl InitializeSharedLiquidityPool<'_> {
    pub fn validate(&self, params: &InitializeSharedLiquidityPoolParams) -> Result<()> {
        require_eq!(self.dao.token_mint, self.base_mint.key());
        require_eq!(self.dao.usdc_mint, self.quote_mint.key());

        require_neq!(self.base_mint.key(), self.quote_mint.key());

        // Ensure pool creator has enough tokens
        require_gte!(self.creator_base_token_account.amount, params.base_amount);
        require_gte!(self.creator_quote_token_account.amount, params.quote_amount);

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: InitializeSharedLiquidityPoolParams) -> Result<()> {
        // Raydium requires that token_0 < token_1
        let (
            token_0_mint,
            token_1_mint,
            token_0_vault,
            token_1_vault,
            creator_token_0,
            creator_token_1,
            init_amount_0,
            init_amount_1,
        ) = if ctx.accounts.base_mint.key() < ctx.accounts.quote_mint.key() {
            (
                ctx.accounts.base_mint.to_account_info(),
                ctx.accounts.quote_mint.to_account_info(),
                ctx.accounts.spot_pool_base_vault.to_account_info(),
                ctx.accounts.spot_pool_quote_vault.to_account_info(),
                ctx.accounts.creator_base_token_account.to_account_info(),
                ctx.accounts.creator_quote_token_account.to_account_info(),
                params.base_amount,
                params.quote_amount,
            )
        } else {
            (
                ctx.accounts.quote_mint.to_account_info(),
                ctx.accounts.base_mint.to_account_info(),
                ctx.accounts.spot_pool_quote_vault.to_account_info(),
                ctx.accounts.spot_pool_base_vault.to_account_info(),
                ctx.accounts.creator_quote_token_account.to_account_info(),
                ctx.accounts.creator_base_token_account.to_account_info(),
                params.quote_amount,
                params.base_amount,
            )
        };

        let cpi_accounts = cpi::accounts::Initialize {
            creator: ctx.accounts.creator.to_account_info(),
            amm_config: ctx.accounts.amm_config.to_account_info(),
            authority: ctx.accounts.raydium_authority.to_account_info(),
            pool_state: ctx.accounts.spot_pool.to_account_info(),
            lp_mint: ctx.accounts.spot_pool_lp_mint.to_account_info(),
            creator_lp_token: ctx.accounts.creator_lp_account.to_account_info(),
            create_pool_fee: ctx.accounts.create_pool_fee.to_account_info(),
            observation_state: ctx.accounts.spot_pool_observation_state.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            token_0_program: ctx.accounts.token_program.to_account_info(),
            token_1_program: ctx.accounts.token_program.to_account_info(),
            associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
            token_0_mint,
            token_1_mint,
            token_0_vault,
            token_1_vault,
            creator_token_0,
            creator_token_1,
        };

        let ix = instruction::Initialize {
            init_amount_0,
            init_amount_1,
            open_time: 0,
        };
        let mut ix_data = Vec::with_capacity(256);
        ix_data.extend_from_slice(&instruction::Initialize::discriminator());
        AnchorSerialize::serialize(&ix, &mut ix_data)?;

        let ix = solana_program::instruction::Instruction {
            program_id: ctx.accounts.cp_swap_program.key(),
            accounts: cpi_accounts
                .to_account_metas(None)
                .into_iter()
                .zip(cpi_accounts.to_account_infos())
                .map(|mut pair| {
                    pair.0.is_signer = pair.1.is_signer;
                    if pair.0.pubkey == ctx.accounts.creator.key()
                        || pair.0.pubkey == ctx.accounts.spot_pool.key()
                    {
                        pair.0.is_signer = true;
                    }
                    pair.0
                })
                .collect(),
            data: ix_data,
        };

        let spot_pool_index = 0_u32.to_le_bytes();
        let pool_seeds = &[b"spot_pool", &spot_pool_index[..], &[ctx.bumps.spot_pool]];
        let raydium_signer = &[&pool_seeds[..]];

        solana_program::program::invoke_signed(
            &ix,
            &cpi_accounts.to_account_infos(),
            raydium_signer,
        )?;


        // First, initialize the shared liquidity pool's lp vault

        associated_token::create(
            CpiContext::new(
                ctx.accounts.associated_token_program.to_account_info(),
                associated_token::Create {
                    payer: ctx.accounts.creator.to_account_info(),
                    mint: ctx.accounts.spot_pool_lp_mint.to_account_info(),
                    authority: ctx.accounts.sl_pool_signer.to_account_info(),
                    associated_token: ctx.accounts.sl_pool_spot_lp_vault.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                }
            )
        )?;


        // Transfer LP tokens from pool creator to shared liquidity pool. We can transfer
        // the full amount because they should have had 0 before
        let creator_lp_account = ctx.accounts.creator_lp_account.to_account_info();
        let creator_lp_account: TokenAccount =
            TokenAccount::try_deserialize(&mut &creator_lp_account.data.borrow()[..])?;

        anchor_spl::token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.creator_lp_account.to_account_info(),
                    to: ctx.accounts.sl_pool_spot_lp_vault.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
            ),
            creator_lp_account.amount,
        )?;

        // Initialize the shared liquidity pool state
        ctx.accounts.sl_pool.set_inner(SharedLiquidityPool {
            dao: ctx.accounts.dao.key(),
            base_mint: ctx.accounts.base_mint.key(),
            quote_mint: ctx.accounts.quote_mint.key(),
            is_base_token_0: ctx.accounts.base_mint.key() < ctx.accounts.quote_mint.key(),
            sl_pool_signer: ctx.accounts.sl_pool_signer.key(),
            sl_pool_signer_bump: ctx.bumps.sl_pool_signer,
            sl_pool_base_vault: ctx.accounts.sl_pool_base_vault.key(),
            sl_pool_quote_vault: ctx.accounts.sl_pool_quote_vault.key(),
            sl_pool_spot_lp_vault: ctx.accounts.sl_pool_spot_lp_vault.key(),
            active_spot_pool: ctx.accounts.spot_pool.key(),
            active_spot_pool_index: 0,
            active_proposal: None,
            pda_bump: ctx.bumps.sl_pool,
            seq_num: 0,
        });

        Ok(())
    }
}
