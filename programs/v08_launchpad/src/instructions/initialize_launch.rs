use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use mint_governor::{
    cpi::{
        accounts::{AddMintAuthority, InitializeMintGovernor, TransferAuthorityToGovernor},
        add_mint_authority, initialize_mint_governor, transfer_authority_to_governor,
    },
    program::MintGovernor as MintGovernorProgram,
    AddMintAuthorityArgs,
};

use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchInitializedEvent};
use crate::state::{Launch, LaunchState};
use crate::{
    usdc_mint, TOKENS_TO_DAMM_V2_LIQUIDITY, TOKENS_TO_FUTARCHY_LIQUIDITY, TOKENS_TO_PARTICIPANTS,
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
    pub team_address: Pubkey,
    pub additional_tokens_amount: u64,
    pub accumulator_activation_delay_seconds: u32,
    pub has_bid_wall: bool,
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
    pub launch: Box<Account<'info, Launch>>,

    #[account(
        mut,
        mint::decimals = 6,
        mint::authority = launch_signer,
    )]
    pub base_mint: Box<Account<'info, Mint>>,

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
    pub quote_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = base_mint,
        associated_token::authority = launch_signer
    )]
    pub base_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: account not used, just for constraints
    pub launch_authority: UncheckedAccount<'info>,

    #[account(mint::decimals = 6, address = usdc_mint::id())]
    pub quote_mint: Box<Account<'info, Mint>>,

    /// CHECK: Just the recipient of the additional tokens
    pub additional_tokens_recipient: Option<UncheckedAccount<'info>>,

    /// PDA: seeds = [b"mint_governor", base_mint, launch_signer (create_key)]
    /// Initialized via CPI to mint_governor::initialize_mint_governor
    /// CHECK: initialized via CPI
    #[account(mut)]
    pub mint_governor: UncheckedAccount<'info>,

    /// PDA: seeds = [b"mint_authority", mint_governor, launch_signer (authorized_minter)]
    /// Initialized via CPI to mint_governor::add_mint_authority
    /// CHECK: initialized via CPI
    #[account(mut)]
    pub mint_authority: UncheckedAccount<'info>,

    pub mint_governor_program: Program<'info, MintGovernorProgram>,

    /// CHECK: checked by mint_governor program
    pub mint_governor_event_authority: UncheckedAccount<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub token_metadata_program: Program<'info, Metadata>,
}

impl InitializeLaunch<'_> {
    pub fn validate(&self, args: &InitializeLaunchArgs) -> Result<()> {
        require_gt!(
            args.minimum_raise_amount,
            0,
            LaunchpadError::InvalidMinimumRaiseAmount
        );

        require_gte!(
            60 * 60 * 24 * 14,
            args.seconds_for_launch,
            LaunchpadError::InvalidSecondsForLaunch
        );

        require_gt!(
            args.seconds_for_launch,
            args.accumulator_activation_delay_seconds,
            LaunchpadError::InvalidAccumulatorActivationDelaySeconds
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

        require_gte!(
            args.minimum_raise_amount,
            futarchy::MIN_QUOTE_LIQUIDITY * 5,
            LaunchpadError::InvalidMinimumRaiseAmount
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

        require!(
            !args.monthly_spending_limit_members.is_empty(),
            LaunchpadError::InvalidMonthlySpendingLimitMembers
        );

        let mut sorted_members = args.monthly_spending_limit_members.clone();
        sorted_members.sort();
        let has_duplicates = sorted_members.windows(2).any(|win| win[0] == win[1]);
        require!(
            !has_duplicates,
            LaunchpadError::InvalidMonthlySpendingLimitMembers
        );

        require_gte!(
            args.months_until_insiders_can_unlock,
            12,
            LaunchpadError::InvalidPerformancePackageMinUnlockTime
        );

        require_gte!(
            args.performance_package_token_amount,
            10,
            LaunchpadError::InvalidPerformancePackageTokenAmount
        );

        require!(self.base_mint.supply == 0, LaunchpadError::SupplyNonZero);

        if args.additional_tokens_amount > 0 {
            require!(
                self.additional_tokens_recipient.is_some(),
                LaunchpadError::InvalidAdditionalTokensRecipient
            );
        } else {
            require!(
                self.additional_tokens_recipient.is_none(),
                LaunchpadError::InvalidAdditionalTokensRecipient
            );
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: InitializeLaunchArgs) -> Result<()> {
        // Initialize Launch account
        ctx.accounts.launch.set_inner(Launch {
            minimum_raise_amount: args.minimum_raise_amount,
            monthly_spending_limit_amount: args.monthly_spending_limit_amount,
            monthly_spending_limit_members: args.monthly_spending_limit_members.clone(),
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
            seconds_for_launch: args.seconds_for_launch,
            dao: None,
            dao_vault: None,
            performance_package_grantee: args.performance_package_grantee,
            performance_package_token_amount: args.performance_package_token_amount,
            months_until_insiders_can_unlock: args.months_until_insiders_can_unlock,
            team_address: args.team_address,
            total_approved_amount: 0,
            additional_tokens_amount: args.additional_tokens_amount,
            additional_tokens_recipient: ctx
                .accounts
                .additional_tokens_recipient
                .as_ref()
                .map(|a| a.key()),
            additional_tokens_claimed: false,
            unix_timestamp_completed: None,
            is_performance_package_initialized: false,
            accumulator_activation_delay_seconds: args.accumulator_activation_delay_seconds,
            has_bid_wall: args.has_bid_wall,
            mint_governor: ctx.accounts.mint_governor.key(),
        });

        let launch_key = ctx.accounts.launch.key();
        let seeds = &[
            b"launch_signer",
            launch_key.as_ref(),
            &[ctx.bumps.launch_signer],
        ];
        let signer = &[&seeds[..]];

        // Create token metadata
        create_metadata_accounts_v3(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.token_metadata.to_account_info(),
                    mint: ctx.accounts.base_mint.to_account_info(),
                    mint_authority: ctx.accounts.launch_signer.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    update_authority: ctx.accounts.launch_signer.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                signer,
            ),
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

        // Set up MintGovernor: create governor, add launch_signer as minter, transfer mint authority
        initialize_mint_governor(CpiContext::new_with_signer(
            ctx.accounts.mint_governor_program.to_account_info(),
            InitializeMintGovernor {
                mint: ctx.accounts.base_mint.to_account_info(),
                mint_governor: ctx.accounts.mint_governor.to_account_info(),
                create_key: ctx.accounts.launch_signer.to_account_info(),
                admin: ctx.accounts.launch_signer.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                event_authority: ctx.accounts.mint_governor_event_authority.to_account_info(),
                program: ctx.accounts.mint_governor_program.to_account_info(),
            },
            signer,
        ))?;

        let max_total = TOKENS_TO_PARTICIPANTS
            + TOKENS_TO_FUTARCHY_LIQUIDITY
            + TOKENS_TO_DAMM_V2_LIQUIDITY
            + args.additional_tokens_amount;

        add_mint_authority(
            CpiContext::new_with_signer(
                ctx.accounts.mint_governor_program.to_account_info(),
                AddMintAuthority {
                    mint_governor: ctx.accounts.mint_governor.to_account_info(),
                    mint_authority: ctx.accounts.mint_authority.to_account_info(),
                    admin: ctx.accounts.launch_signer.to_account_info(),
                    authorized_minter: ctx.accounts.launch_signer.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    event_authority: ctx.accounts.mint_governor_event_authority.to_account_info(),
                    program: ctx.accounts.mint_governor_program.to_account_info(),
                },
                signer,
            ),
            AddMintAuthorityArgs {
                max_total: Some(max_total),
            },
        )?;

        transfer_authority_to_governor(CpiContext::new_with_signer(
            ctx.accounts.mint_governor_program.to_account_info(),
            TransferAuthorityToGovernor {
                mint_governor: ctx.accounts.mint_governor.to_account_info(),
                mint: ctx.accounts.base_mint.to_account_info(),
                current_authority: ctx.accounts.launch_signer.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                event_authority: ctx.accounts.mint_governor_event_authority.to_account_info(),
                program: ctx.accounts.mint_governor_program.to_account_info(),
            },
            signer,
        ))?;

        let clock = Clock::get()?;
        emit_cpi!(LaunchInitializedEvent {
            common: CommonFields::new(&clock, 0),
            launch: ctx.accounts.launch.key(),
            minimum_raise_amount: args.minimum_raise_amount,
            performance_package_grantee: args.performance_package_grantee,
            performance_package_token_amount: args.performance_package_token_amount,
            months_until_insiders_can_unlock: args.months_until_insiders_can_unlock,
            monthly_spending_limit_amount: args.monthly_spending_limit_amount,
            monthly_spending_limit_members: args.monthly_spending_limit_members,
            launch_authority: ctx.accounts.launch_authority.key(),
            launch_signer: ctx.accounts.launch_signer.key(),
            launch_signer_pda_bump: ctx.bumps.launch_signer,
            launch_usdc_vault: ctx.accounts.quote_vault.key(),
            launch_token_vault: ctx.accounts.base_vault.key(),
            base_mint: ctx.accounts.base_mint.key(),
            quote_mint: ctx.accounts.quote_mint.key(),
            pda_bump: ctx.bumps.launch,
            seconds_for_launch: args.seconds_for_launch,
            additional_tokens_amount: args.additional_tokens_amount,
            additional_tokens_recipient: ctx
                .accounts
                .additional_tokens_recipient
                .as_ref()
                .map(|a| a.key()),
            accumulator_activation_delay_seconds: args.accumulator_activation_delay_seconds,
            has_bid_wall: args.has_bid_wall,
            mint_governor: ctx.accounts.mint_governor.key(),
        });

        Ok(())
    }
}
