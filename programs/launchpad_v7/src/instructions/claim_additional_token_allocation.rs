use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchClaimAdditionalTokenAllocationEvent};
use crate::state::{Launch, LaunchState};

#[event_cpi]
#[derive(Accounts)]
pub struct ClaimAdditionalTokenAllocation<'info> {
    #[account(
        mut,
        has_one = launch_base_vault,
        has_one = launch_signer,
        has_one = base_mint,
    )]
    pub launch: Account<'info, Launch>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: just a signer
    #[account(mut)]
    pub launch_signer: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = launch_signer,
    )]
    pub launch_base_vault: Account<'info, TokenAccount>,

    #[account(mut, address = launch.base_mint)]
    pub base_mint: Account<'info, Mint>,

    /// CHECK: The recipient of the additional tokens, used for constraints, explicitly checked in validate
    pub additional_tokens_recipient: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = base_mint,
        associated_token::authority = additional_tokens_recipient,
    )]
    pub additional_tokens_recipient_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl ClaimAdditionalTokenAllocation<'_> {
    pub fn validate(&self) -> Result<()> {
        // The launch must be completed
        require_eq!(
            self.launch.state,
            LaunchState::Complete,
            LaunchpadError::InvalidLaunchState
        );

        // The additional tokens must not have been claimed yet
        require!(
            !self.launch.additional_tokens_claimed,
            LaunchpadError::AdditionalTokensAlreadyClaimed
        );

        // A claim can be performed only if an additional tokens recipient is set
        require!(
            self.launch.additional_tokens_recipient.is_some(),
            LaunchpadError::NoAdditionalTokensRecipientSet
        );

        // The additional tokens recipient must be the same as the one set in the launch
        require_keys_eq!(
            self.additional_tokens_recipient.key(),
            self.launch.additional_tokens_recipient.unwrap(),
            LaunchpadError::InvalidAdditionalTokensRecipient
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let launch_key = ctx.accounts.launch.key();
        let launch_signer_seeds = &[
            b"launch_signer",
            launch_key.as_ref(),
            &[ctx.accounts.launch.launch_signer_pda_bump],
        ];
        let launch_signer = &[&launch_signer_seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.launch_base_vault.to_account_info(),
                    to: ctx
                        .accounts
                        .additional_tokens_recipient_token_account
                        .to_account_info(),
                    authority: ctx.accounts.launch_signer.to_account_info(),
                },
                launch_signer,
            ),
            ctx.accounts.launch.additional_tokens_amount,
        )?;

        ctx.accounts.launch.additional_tokens_claimed = true;
        ctx.accounts.launch.seq_num += 1;

        let clock = Clock::get()?;

        emit_cpi!(LaunchClaimAdditionalTokenAllocationEvent {
            common: CommonFields::new(&clock, ctx.accounts.launch.seq_num),
            launch: ctx.accounts.launch.key(),
            additional_tokens_amount: ctx.accounts.launch.additional_tokens_amount,
            additional_tokens_recipient: ctx.accounts.additional_tokens_recipient.key(),
        });

        Ok(())
    }
}
