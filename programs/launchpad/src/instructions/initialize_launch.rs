use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchInitializedEvent};
use crate::state::{Launch, LaunchState};
use crate::MAX_PREMINE;
use crate::{
    usdc_mint, TOKENS_TO_DAMM_V2_LIQUIDITY, TOKENS_TO_FUTARCHY_LIQUIDITY, TOKENS_TO_PARTICIPANTS,
    TOKEN_SCALE,
};
use anchor_spl::metadata::{
    create_metadata_accounts_v3, mpl_token_metadata::types::DataV2,
    mpl_token_metadata::ID as MPL_TOKEN_METADATA_PROGRAM_ID, CreateMetadataAccountsV3, Metadata,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeLaunchArgs {
    pub minimum_raise_amount: u64,
    pub monthly_spending_limit_amount: u64,
    pub monthly_spending_limit_members: Vec<Pubkey>,
    pub seconds_for_launch: u32,
    pub token_name: String,
    pub token_symbol: String,
    pub token_uri: String,
    pub performance_package_grantee: Pubkey,
    pub performance_package_token_amount: u64,
    pub months_until_insiders_can_unlock: u8,
}

#[event_cpi]
#[derive(Accounts)]
pub struct InitializeLaunch<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Launch::INIT_SPACE,
        seeds = [b"launch", base_mint.key().as_ref()],
        bump
    )]
    pub launch: Account<'info, Launch>,

    #[account(
        mut,
        mint::decimals = 6,
        mint::authority = launch_signer,
    )]
    pub base_mint: Account<'info, Mint>,

    /// CHECK: This is the token metadata
    #[account(
        mut,
        seeds = [b"metadata", MPL_TOKEN_METADATA_PROGRAM_ID.as_ref(), base_mint.key().as_ref()],
        seeds::program = MPL_TOKEN_METADATA_PROGRAM_ID,
        bump
    )]
    pub token_metadata: UncheckedAccount<'info>,

    /// CHECK: This is the launch signer
    #[account(
        seeds = [b"launch_signer", launch.key().as_ref()],
        bump
    )]
    pub launch_signer: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = quote_mint,
        associated_token::authority = launch_signer
    )]
    pub quote_vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = base_mint,
        associated_token::authority = launch_signer
    )]
    pub base_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: account not used, just for constraints
    pub launch_authority: UncheckedAccount<'info>,

    #[account(mint::decimals = 6, address = usdc_mint::id())]
    pub quote_mint: Account<'info, Mint>,

    pub rent: Sysvar<'info, Rent>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub token_metadata_program: Program<'info, Metadata>,
}

impl InitializeLaunch<'_> {
    pub fn validate(&self, args: &InitializeLaunchArgs) -> Result<()> {
        #[cfg(not(feature = "devnet"))]
        require_gte!(
            args.seconds_for_launch,
            60 * 60,
            LaunchpadError::InvalidSecondsForLaunch
        );

        require_gte!(
            60 * 60 * 24 * 14,
            args.seconds_for_launch,
            LaunchpadError::InvalidSecondsForLaunch
        );

        require!(
            self.base_mint.freeze_authority.is_none(),
            LaunchpadError::FreezeAuthoritySet
        );

        require_gte!(
            args.minimum_raise_amount,
            args.monthly_spending_limit_amount * 6,
            LaunchpadError::InvalidMonthlySpendingLimit
        );

        require_neq!(
            args.monthly_spending_limit_amount,
            0,
            LaunchpadError::InvalidMonthlySpendingLimit
        );

        require_gte!(
            futarchy::MAX_SPENDING_LIMIT_MEMBERS,
            args.monthly_spending_limit_members.len(),
            LaunchpadError::InvalidMonthlySpendingLimitMembers
        );

        require_gte!(
            MAX_PREMINE * TOKEN_SCALE,
            args.performance_package_token_amount,
            LaunchpadError::InvalidPriceBasedPremineAmount
        );

        require_gte!(
            args.months_until_insiders_can_unlock,
            18,
            LaunchpadError::InvalidPerformancePackageMinUnlockTime
        );

        require!(self.base_mint.supply == 0, LaunchpadError::SupplyNonZero);

        #[cfg(feature = "production")]
        {
            let base_token_key: String = self.base_mint.key().to_string();
            let last_4_chars = &base_token_key[base_token_key.len() - 4..];
            require_eq!("meta", last_4_chars, LaunchpadError::InvalidTokenKey);
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: InitializeLaunchArgs) -> Result<()> {
        ctx.accounts.launch.set_inner(Launch {
            minimum_raise_amount: args.minimum_raise_amount,
            monthly_spending_limit_amount: args.monthly_spending_limit_amount,
            monthly_spending_limit_members: args.monthly_spending_limit_members,
            launch_authority: ctx.accounts.launch_authority.key(),
            launch_signer: ctx.accounts.launch_signer.key(),
            launch_signer_pda_bump: ctx.bumps.launch_signer,
            launch_quote_vault: ctx.accounts.quote_vault.key(),
            launch_base_vault: ctx.accounts.base_vault.key(),
            total_committed_amount: 0,
            base_mint: ctx.accounts.base_mint.key(),
            quote_mint: ctx.accounts.quote_mint.key(),
            pda_bump: ctx.bumps.launch,
            seq_num: 0,
            state: LaunchState::Initialized,
            unix_timestamp_started: None,
            unix_timestamp_closed: None,
            final_raise_amount: None,
            seconds_for_launch: args.seconds_for_launch,
            dao: None,
            dao_vault: None,
            performance_package_grantee: args.performance_package_grantee,
            performance_package_token_amount: args.performance_package_token_amount,
            months_until_insiders_can_unlock: args.months_until_insiders_can_unlock,
        });

        let clock = Clock::get()?;
        emit_cpi!(LaunchInitializedEvent {
            common: CommonFields::new(&clock, 0),
            launch: ctx.accounts.launch.key(),
            minimum_raise_amount: args.minimum_raise_amount,
            launch_authority: ctx.accounts.launch_authority.key(),
            launch_signer: ctx.accounts.launch_signer.key(),
            launch_signer_pda_bump: ctx.bumps.launch_signer,
            launch_usdc_vault: ctx.accounts.quote_vault.key(),
            launch_token_vault: ctx.accounts.base_vault.key(),
            base_mint: ctx.accounts.base_mint.key(),
            quote_mint: ctx.accounts.quote_mint.key(),
            pda_bump: ctx.bumps.launch,
            seconds_for_launch: args.seconds_for_launch,
        });

        let launch_key = ctx.accounts.launch.key();

        let seeds = &[
            b"launch_signer",
            launch_key.as_ref(),
            &[ctx.bumps.launch_signer],
        ];
        let signer = &[&seeds[..]];

        let cpi_program = ctx.accounts.token_metadata_program.to_account_info();

        let cpi_accounts = CreateMetadataAccountsV3 {
            metadata: ctx.accounts.token_metadata.to_account_info(),
            mint: ctx.accounts.base_mint.to_account_info(),
            mint_authority: ctx.accounts.launch_signer.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            update_authority: ctx.accounts.launch_signer.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };

        create_metadata_accounts_v3(
            CpiContext::new(cpi_program, cpi_accounts).with_signer(signer),
            DataV2 {
                name: args.token_name.clone(),
                symbol: args.token_symbol.clone(),
                uri: args.token_uri.clone(),
                seller_fee_basis_points: 0,
                creators: None,
                collection: None,
                uses: None,
            },
            true,
            true,
            None,
        )?;

        // Mint total tokens to launch token vault
        // Include premine amount since complete_launch will transfer it to price-based unlock
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.base_mint.to_account_info(),
                    to: ctx.accounts.base_vault.to_account_info(),
                    authority: ctx.accounts.launch_signer.to_account_info(),
                },
                signer,
            ),
            args.performance_package_token_amount
                + TOKENS_TO_PARTICIPANTS
                + TOKENS_TO_FUTARCHY_LIQUIDITY
                + TOKENS_TO_DAMM_V2_LIQUIDITY,
        )?;

        Ok(())
    }
}
