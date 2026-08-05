use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::{
    create_metadata_accounts_v3, mpl_token_metadata::types::DataV2,
    mpl_token_metadata::ID as MPL_TOKEN_METADATA_PROGRAM_ID, CreateMetadataAccountsV3, Metadata,
};
use anchor_spl::token::{
    self, spl_token::instruction::AuthorityType, Mint, MintTo, SetAuthority, Token, TokenAccount,
};
use anchor_spl::token_2022::spl_token_2022::{
    extension::{BaseStateWithExtensions, ExtensionType, StateWithExtensions},
    state::Mint as MintWithExtensions,
};
use anchor_spl::token_interface;

use crate::error::RelaunchError;
use crate::events::{CommonFields, RelaunchInitializedEvent};
use crate::pump_amm;
use crate::state::{Relaunch, RelaunchState};
use crate::{
    pump_amm_program, pump_program, usdc_mint, wsol_mint, MAX_SECONDS_FOR_DEPOSITS,
    PUMP_POOL_AUTHORITY_SEED, PUMP_POOL_SEED, TOKENS_TO_DEPOSITORS, TOKENS_TO_FUTARCHY_LIQUIDITY,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeRelaunchArgs {
    pub token_name: String,
    pub token_symbol: String,
    pub token_uri: String,
    pub seconds_for_deposits: u32,
    pub grace_period_seconds: u32,
    pub threshold_bps: u16,
    pub monthly_spending_limit_amount: u64,
    pub monthly_spending_limit_members: Vec<Pubkey>,
    pub team_address: Pubkey,
}

#[event_cpi]
#[derive(Accounts)]
pub struct InitializeRelaunch<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Relaunch::INIT_SPACE,
        seeds = [b"relaunch", new_mint.key().as_ref()],
        bump
    )]
    pub relaunch: Box<Account<'info, Relaunch>>,

    #[account(
        mut,
        mint::decimals = 6,
        mint::authority = mint_authority,
    )]
    pub new_mint: Box<Account<'info, Mint>>,

    /// Proof that the initializer controls the new mint: must sign, and the
    /// handler CPIs `set_authority` to hand minting to `relaunch_signer`.
    pub mint_authority: Signer<'info>,

    /// CHECK: PDA that signs CPIs and owns the vaults
    #[account(
        seeds = [b"relaunch_signer", relaunch.key().as_ref()],
        bump
    )]
    pub relaunch_signer: UncheckedAccount<'info>,

    #[account(mint::token_program = old_token_program)]
    pub old_mint: Box<InterfaceAccount<'info, token_interface::Mint>>,

    /// CHECK: fingerprint-checked in validate()
    pub source_pool: UncheckedAccount<'info>,

    pub source_quote_mint: Box<Account<'info, Mint>>,

    #[account(address = usdc_mint::id())]
    pub usdc_mint: Box<Account<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = old_mint,
        associated_token::authority = relaunch_signer,
        associated_token::token_program = old_token_program,
    )]
    pub old_token_vault: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = new_mint,
        associated_token::authority = relaunch_signer,
    )]
    pub new_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = source_quote_mint,
        associated_token::authority = relaunch_signer,
    )]
    pub source_quote_vault: Box<Account<'info, TokenAccount>>,

    /// The same account as `source_quote_vault` for USDC-quoted sources, in
    /// which case the `init_if_needed` is a no-op revalidation.
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = usdc_mint,
        associated_token::authority = relaunch_signer,
    )]
    pub usdc_vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: This is the token metadata
    #[account(
        mut,
        seeds = [b"metadata", MPL_TOKEN_METADATA_PROGRAM_ID.as_ref(), new_mint.key().as_ref()],
        seeds::program = MPL_TOKEN_METADATA_PROGRAM_ID,
        bump
    )]
    pub token_metadata: UncheckedAccount<'info>,

    /// CHECK: The initializer; gains the sell/swap monopoly during the grace
    /// period. Not required to sign, mirroring launchpad's launch_authority.
    pub admin: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub rent: Sysvar<'info, Rent>,

    pub old_token_program: Interface<'info, token_interface::TokenInterface>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub token_metadata_program: Program<'info, Metadata>,
}

impl InitializeRelaunch<'_> {
    pub fn validate(&self, args: &InitializeRelaunchArgs) -> Result<()> {
        require_eq!(self.new_mint.supply, 0, RelaunchError::SupplyNonZero);

        require!(
            self.new_mint.freeze_authority.is_none(),
            RelaunchError::FreezeAuthoritySet
        );

        require!(
            self.source_quote_mint.key() == wsol_mint::id()
                || self.source_quote_mint.key() == usdc_mint::id(),
            RelaunchError::InvalidQuoteMint
        );

        require_keys_eq!(
            *self.source_pool.owner,
            pump_amm_program::id(),
            RelaunchError::SourcePoolNotCanonical
        );

        let pool = pump_amm::PumpSwapPool::try_parse(&self.source_pool.try_borrow_data()?)?;

        require_eq!(pool.index, 0, RelaunchError::SourcePoolNotCanonical);

        require_keys_eq!(
            pool.base_mint,
            self.old_mint.key(),
            RelaunchError::SourcePoolNotCanonical
        );

        let (pool_authority, _) = Pubkey::find_program_address(
            &[PUMP_POOL_AUTHORITY_SEED, self.old_mint.key().as_ref()],
            &pump_program::id(),
        );
        require_keys_eq!(
            pool.creator,
            pool_authority,
            RelaunchError::SourcePoolNotCanonical
        );

        require_keys_eq!(
            pool.quote_mint,
            self.source_quote_mint.key(),
            RelaunchError::SourcePoolQuoteMintMismatch
        );

        // The fields above are also the pool PDA's seeds, so re-deriving the
        // address re-checks them without relying on pump_amm keeping stored
        // fields consistent with seeds.
        let (canonical_pool, _) = Pubkey::find_program_address(
            &[
                PUMP_POOL_SEED,
                &0u16.to_le_bytes(),
                pool_authority.as_ref(),
                self.old_mint.key().as_ref(),
                self.source_quote_mint.key().as_ref(),
            ],
            &pump_amm_program::id(),
        );
        require_keys_eq!(
            self.source_pool.key(),
            canonical_pool,
            RelaunchError::SourcePoolNotCanonical
        );

        // Old mints may carry only mint-embedded metadata extensions; anything
        // else (transfer fees, hooks, ...) is rejected rather than assumed safe.
        let old_mint_info = self.old_mint.to_account_info();
        if *old_mint_info.owner == anchor_spl::token_2022::ID {
            let old_mint_data = old_mint_info.try_borrow_data()?;
            let old_mint_state = StateWithExtensions::<MintWithExtensions>::unpack(&old_mint_data)?;
            for extension in old_mint_state.get_extension_types()? {
                require!(
                    matches!(
                        extension,
                        ExtensionType::MetadataPointer | ExtensionType::TokenMetadata
                    ),
                    RelaunchError::ForbiddenOldMintExtension
                );
            }
        }

        require_gt!(args.threshold_bps, 0, RelaunchError::InvalidThresholdBps);
        require_gte!(
            10_000,
            args.threshold_bps,
            RelaunchError::InvalidThresholdBps
        );

        require_gte!(
            MAX_SECONDS_FOR_DEPOSITS,
            args.seconds_for_deposits,
            RelaunchError::InvalidSecondsForDeposits
        );

        // A zero amount with no members means the DAO launches without a
        // spending limit; a config missing either half is invalid.
        require!(
            (args.monthly_spending_limit_amount == 0)
                == args.monthly_spending_limit_members.is_empty(),
            RelaunchError::InvalidMonthlySpendingLimit
        );

        require_gte!(
            futarchy::MAX_SPENDING_LIMIT_MEMBERS,
            args.monthly_spending_limit_members.len(),
            RelaunchError::InvalidMonthlySpendingLimitMembers
        );

        let mut sorted_members = args.monthly_spending_limit_members.clone();
        sorted_members.sort();
        let has_duplicates = sorted_members.windows(2).any(|win| win[0] == win[1]);
        require!(
            !has_duplicates,
            RelaunchError::InvalidMonthlySpendingLimitMembers
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: InitializeRelaunchArgs) -> Result<()> {
        let relaunch_key = ctx.accounts.relaunch.key();

        let seeds = &[
            b"relaunch_signer",
            relaunch_key.as_ref(),
            &[ctx.bumps.relaunch_signer],
        ];
        let signer = &[&seeds[..]];

        token::set_authority(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    account_or_mint: ctx.accounts.new_mint.to_account_info(),
                    current_authority: ctx.accounts.mint_authority.to_account_info(),
                },
            ),
            AuthorityType::MintTokens,
            Some(ctx.accounts.relaunch_signer.key()),
        )?;

        create_metadata_accounts_v3(
            CpiContext::new(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.token_metadata.to_account_info(),
                    mint: ctx.accounts.new_mint.to_account_info(),
                    mint_authority: ctx.accounts.relaunch_signer.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    update_authority: ctx.accounts.relaunch_signer.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
            )
            .with_signer(signer),
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

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.new_mint.to_account_info(),
                    to: ctx.accounts.new_token_vault.to_account_info(),
                    authority: ctx.accounts.relaunch_signer.to_account_info(),
                },
                signer,
            ),
            TOKENS_TO_DEPOSITORS + TOKENS_TO_FUTARCHY_LIQUIDITY,
        )?;

        let old_supply_snapshot = ctx.accounts.old_mint.supply;

        ctx.accounts.relaunch.set_inner(Relaunch {
            admin: ctx.accounts.admin.key(),
            new_mint: ctx.accounts.new_mint.key(),
            old_mint: ctx.accounts.old_mint.key(),
            source_pool: ctx.accounts.source_pool.key(),
            source_quote_mint: ctx.accounts.source_quote_mint.key(),
            relaunch_signer: ctx.accounts.relaunch_signer.key(),
            relaunch_signer_bump: ctx.bumps.relaunch_signer,
            old_token_vault: ctx.accounts.old_token_vault.key(),
            new_token_vault: ctx.accounts.new_token_vault.key(),
            source_quote_vault: ctx.accounts.source_quote_vault.key(),
            usdc_vault: ctx.accounts.usdc_vault.key(),
            threshold_bps: args.threshold_bps,
            old_supply_snapshot,
            seconds_for_deposits: args.seconds_for_deposits,
            grace_period_seconds: args.grace_period_seconds,
            monthly_spending_limit_amount: args.monthly_spending_limit_amount,
            monthly_spending_limit_members: args.monthly_spending_limit_members.clone(),
            team_address: args.team_address,
            state: RelaunchState::Initialized,
            total_deposited: 0,
            quote_recovered: 0,
            usdc_recovered: 0,
            unix_timestamp_started: None,
            unix_timestamp_closed: None,
            unix_timestamp_completed: None,
            dao: None,
            dao_vault: None,
            seq_num: 0,
            pda_bump: ctx.bumps.relaunch,
        });

        let clock = Clock::get()?;
        emit_cpi!(RelaunchInitializedEvent {
            common: CommonFields::new(&clock, 0),
            relaunch: relaunch_key,
            admin: ctx.accounts.admin.key(),
            new_mint: ctx.accounts.new_mint.key(),
            old_mint: ctx.accounts.old_mint.key(),
            source_pool: ctx.accounts.source_pool.key(),
            source_quote_mint: ctx.accounts.source_quote_mint.key(),
            relaunch_signer: ctx.accounts.relaunch_signer.key(),
            relaunch_signer_bump: ctx.bumps.relaunch_signer,
            old_token_vault: ctx.accounts.old_token_vault.key(),
            new_token_vault: ctx.accounts.new_token_vault.key(),
            source_quote_vault: ctx.accounts.source_quote_vault.key(),
            usdc_vault: ctx.accounts.usdc_vault.key(),
            threshold_bps: args.threshold_bps,
            old_supply_snapshot,
            seconds_for_deposits: args.seconds_for_deposits,
            grace_period_seconds: args.grace_period_seconds,
            monthly_spending_limit_amount: args.monthly_spending_limit_amount,
            monthly_spending_limit_members: args.monthly_spending_limit_members,
            team_address: args.team_address,
            pda_bump: ctx.bumps.relaunch,
        });

        Ok(())
    }
}
