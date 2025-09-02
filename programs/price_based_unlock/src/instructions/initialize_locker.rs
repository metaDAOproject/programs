use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint};
use anchor_spl::associated_token::AssociatedToken;

use super::*;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct InitializeLockerParams {
    pub price_threshold: u128,
    pub token_amount: u64,
    pub unlock_timestamp: i64,
    pub oracle_config: OracleConfig,
    pub twap_length_seconds: u64,
    pub token_recipient: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: InitializeLockerParams)]
#[event_cpi]
pub struct InitializeLocker<'info> {
    #[account(
        init,
        payer = payer,
        seeds = [b"locker", create_key.key().as_ref()],
        bump,
        space = 8 + Locker::INIT_SPACE,
    )]
    pub locker: Account<'info, Locker>,
    /// Used to derive the PDA
    pub create_key: Signer<'info>,
    
    /// The mint of the tokens to be locked
    pub token_mint: Account<'info, Mint>,
    
    /// The token account containing the tokens to be locked
    #[account(mut)]
    pub from_token_account: Box<Account<'info, TokenAccount>>,
    
    /// The authority of the token account
    pub token_authority: Signer<'info>,
    
    
    /// The locker's token account where tokens will be stored
    #[account(
        init,
        seeds = [b"locker_token_account", locker.key().as_ref()],
        bump,
        payer = payer,
        token::mint = token_mint,
        token::authority = locker,
    )]
    pub locker_token_account: Box<Account<'info, TokenAccount>>,
    
    /// The recipient's token account where tokens will be sent when unlocked
    #[account(token::mint = token_mint)]
    pub recipient_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl InitializeLocker<'_> {
    pub fn handle(ctx: Context<Self>, params: InitializeLockerParams) -> Result<()> {
        let InitializeLockerParams {
            price_threshold,
            token_amount,
            unlock_timestamp,
            oracle_config,
            twap_length_seconds,
            token_recipient,
        } = params;

        let locker = &mut ctx.accounts.locker;
        let clock = Clock::get()?;

        // Validate that unlock timestamp is in the future
        require!(
            unlock_timestamp > clock.unix_timestamp,
            PriceBasedUnlockError::UnlockTimestampNotReached
        );

        // Validate that token amount is greater than 0
        require!(token_amount > 0, PriceBasedUnlockError::InvalidOracleData);

        // Transfer tokens from user to locker
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.from_token_account.to_account_info(),
                to: ctx.accounts.locker_token_account.to_account_info(),
                authority: ctx.accounts.token_authority.to_account_info(),
            },
        );

        token::transfer(transfer_ctx, token_amount)?;
        
        locker.set_inner(Locker {
            price_threshold,
            token_amount,
            unlock_timestamp,
            oracle_config,
            twap_length_seconds,
            token_recipient,
            state: LockerState::Locked,
            create_key: ctx.accounts.create_key.key(),
            pda_bump: ctx.bumps.locker,
        });

        emit_cpi!(LockerInitialized {
            locker: locker.key(),
            price_threshold,
            token_amount,
            unlock_timestamp,
            oracle_config,
            token_recipient,
        });

        Ok(())
    }
}
