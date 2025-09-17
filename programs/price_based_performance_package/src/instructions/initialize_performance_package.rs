use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint};
use anchor_spl::associated_token::AssociatedToken;

use super::*;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct InitializePerformancePackageParams {
    pub tranches: Vec<Tranche>,
    pub min_unlock_timestamp: i64,
    pub oracle_config: OracleConfig,
    pub twap_length_seconds: u64,
    pub grantee: Pubkey,
    pub performance_package_authority: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: InitializePerformancePackageParams)]
#[event_cpi]
pub struct InitializePerformancePackage<'info> {
    #[account(
        init,
        payer = payer,
        seeds = [b"performance_package", create_key.key().as_ref()],
        bump,
        space = 8 + PerformancePackage::INIT_SPACE,
    )]
    pub performance_package: Account<'info, PerformancePackage>,
    /// Used to derive the PDA
    pub create_key: Signer<'info>,
    
    /// The mint of the tokens to be locked
    pub token_mint: Account<'info, Mint>,
    
    /// The token account containing the tokens to be locked
    #[account(mut, token::authority = grantor, token::mint = token_mint)]
    pub grantor_token_account: Box<Account<'info, TokenAccount>>,
    
    /// The authority of the token account
    pub grantor: Signer<'info>,
    
    
    /// The locker's token account where tokens will be stored
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = performance_package,
    )]
    pub performance_package_token_vault: Box<Account<'info, TokenAccount>>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl InitializePerformancePackage<'_> {
    pub fn handle(ctx: Context<Self>, params: InitializePerformancePackageParams) -> Result<()> {
        let Self {
            performance_package,
            create_key,
            token_mint,
            grantor_token_account,
            grantor,
            performance_package_token_vault,
            payer: _,
            system_program: _,
            token_program,
            associated_token_program: _,
            event_authority: _,
            program: _,
        } = ctx.accounts;

        let InitializePerformancePackageParams {
            tranches,
            min_unlock_timestamp,
            oracle_config,
            twap_length_seconds,
            grantee,
            performance_package_authority,
        } = params;

        require_neq!(tranches.len(), 0);

        // validate that the tranches are sorted by price threshold
        for i in 1..tranches.len() {
            require_gt!(
                tranches[i].price_threshold,
                tranches[i - 1].price_threshold,
                PriceBasedPerformancePackageError::TranchePriceThresholdsNotMonotonic
            );
        }

        for tranche in tranches.iter() {
            require_gt!(tranche.token_amount, 0, PriceBasedPerformancePackageError::TrancheTokenAmountZero);
        }

        let clock = Clock::get()?;

        // Validate that unlock timestamp is in the future
        require_gt!(
            min_unlock_timestamp,
            clock.unix_timestamp,
            PriceBasedPerformancePackageError::UnlockTimestampInThePast
        );

        let total_token_amount = tranches.iter().map(|tranche| tranche.token_amount).sum();

        require_gt!(total_token_amount, 0);

        require_gte!(grantor_token_account.amount, total_token_amount);

        // Transfer tokens from user to locker
        let transfer_ctx = CpiContext::new(
            token_program.to_account_info(),
            token::Transfer {
                from: grantor_token_account.to_account_info(),
                to: performance_package_token_vault.to_account_info(),
                authority: grantor.to_account_info(),
            },
        );

        token::transfer(transfer_ctx, total_token_amount)?;
        
        performance_package.set_inner(PerformancePackage {
            tranches: tranches.into_iter().map(|tranche| tranche.into()).collect(),
            min_unlock_timestamp,
            oracle_config,
            twap_length_seconds,
            recipient: grantee,
            state: PerformancePackageState::Locked,
            create_key: create_key.key(),
            pda_bump: ctx.bumps.performance_package,
            performance_package_authority,
            token_mint: token_mint.key(),
            total_token_amount,
            already_unlocked_amount: 0,
            performance_package_token_vault: performance_package_token_vault.key(),
            seq_num: 0,
        });

        emit_cpi!(PerformancePackageInitialized {
            common: CommonFields::new(&clock, performance_package.seq_num),
            performance_package: performance_package.key(),
            // performance_package_data: performance_package.clone().into_inner(),
        });

        Ok(())
    }
}
