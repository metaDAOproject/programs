use anchor_lang::prelude::*;

pub mod constants {
    pub mod seeds {
        pub const CONFIG_PREFIX: &[u8] = b"config";
        pub const CUSTOMIZABLE_POOL_PREFIX: &[u8] = b"cpool";
        pub const POOL_PREFIX: &[u8] = b"pool";
        pub const TOKEN_VAULT_PREFIX: &[u8] = b"token_vault";
        pub const POOL_AUTHORITY_PREFIX: &[u8] = b"pool_authority";
        pub const POSITION_PREFIX: &[u8] = b"position";
        pub const POSITION_NFT_ACCOUNT_PREFIX: &[u8] = b"position_nft_account";
        pub const TOKEN_BADGE_PREFIX: &[u8] = b"token_badge";
        pub const REWARD_VAULT_PREFIX: &[u8] = b"reward_vault";
        pub const CLAIM_FEE_OPERATOR_PREFIX: &[u8] = b"cf_operator";
    }

    pub const MIN_SQRT_PRICE: u128 = 4295048016;
    pub const MAX_SQRT_PRICE: u128 = 79226673521066979257578248091;
}

declare_id!("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG");

#[program]
pub mod damm_v2_cpi {
    use super::*;

    pub fn initialize_pool_with_dynamic_config(
        _ctx: Context<InitializePoolWithDynamicConfigCtx>,
        _params: InitializeCustomizablePoolParameters,
    ) -> Result<()> {
        Ok(())
    }
}

/// Information regarding fee charges
#[derive(Copy, Clone, Debug, AnchorSerialize, AnchorDeserialize, InitSpace, Default)]
pub struct PoolFeeParameters {
    /// Base fee
    pub base_fee: BaseFeeParameters,
    /// padding
    pub padding: [u8; 3],
    /// dynamic fee
    pub dynamic_fee: Option<DynamicFeeParameters>,
}

#[derive(Copy, Clone, Debug, AnchorSerialize, AnchorDeserialize, InitSpace, Default)]
pub struct BaseFeeParameters {
    pub cliff_fee_numerator: u64,
    pub number_of_period: u16,
    pub period_frequency: u64,
    pub reduction_factor: u64,
    pub fee_scheduler_mode: u8,
}

#[derive(Copy, Clone, Debug, AnchorSerialize, AnchorDeserialize, InitSpace, Default)]
pub struct DynamicFeeParameters {
    pub bin_step: u16,
    pub bin_step_u128: u128,
    pub filter_period: u16,
    pub decay_period: u16,
    pub reduction_factor: u16,
    pub max_volatility_accumulator: u32,
    pub variable_fee_control: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeCustomizablePoolParameters {
    /// pool fees
    pub pool_fees: PoolFeeParameters,
    /// sqrt min price
    pub sqrt_min_price: u128,
    /// sqrt max price
    pub sqrt_max_price: u128,
    /// has alpha vault
    pub has_alpha_vault: bool,
    /// initialize liquidity
    pub liquidity: u128,
    /// The init price of the pool as a sqrt(token_b/token_a) Q64.64 value
    pub sqrt_price: u128,
    /// activation type
    pub activation_type: u8,
    /// collect fee mode
    pub collect_fee_mode: u8,
    /// activation point
    pub activation_point: Option<u64>,
}

#[event_cpi]
#[derive(Accounts)]
pub struct InitializePoolWithDynamicConfigCtx<'info> {
    /// CHECK: Pool creator
    pub creator: UncheckedAccount<'info>,

    #[account(mut)]
    pub position_nft_mint: Signer<'info>,

    /// CHECK: CPI
    #[account(mut)]
    pub position_nft_account: UncheckedAccount<'info>,

    /// Address paying to create the pool. Can be anyone
    #[account(mut)]
    pub payer: Signer<'info>,

    pub pool_creator_authority: Signer<'info>,

    /// CHECK: CPI
    pub config: UncheckedAccount<'info>,

    /// CHECK: pool authority
    pub pool_authority: UncheckedAccount<'info>,

    /// CHECK: CPI
    #[account(mut)]
    pub pool: UncheckedAccount<'info>,

    /// CHECK: CPI
    #[account(mut)]
    pub position: UncheckedAccount<'info>,

    /// CHECK: CPI
    pub token_a_mint: UncheckedAccount<'info>,

    /// CHECK: CPI
    pub token_b_mint: UncheckedAccount<'info>,

    /// CHECK: CPI
    #[account(mut)]
    pub token_a_vault: UncheckedAccount<'info>,

    /// CHECK: CPI
    #[account(mut)]
    pub token_b_vault: UncheckedAccount<'info>,

    /// CHECK: CPI
    #[account(mut)]
    pub payer_token_a: UncheckedAccount<'info>,

    /// CHECK: CPI
    #[account(mut)]
    pub payer_token_b: UncheckedAccount<'info>,

    /// CHECK: CPI
    pub token_a_program: UncheckedAccount<'info>,
    /// CHECK: CPI
    pub token_b_program: UncheckedAccount<'info>,

    /// CHECK: CPI
    pub token_2022_program: UncheckedAccount<'info>,

    // Sysvar for program account
    pub system_program: Program<'info, System>,
}
