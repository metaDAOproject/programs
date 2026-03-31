use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::events::{CommonFields, LaunchFundsReturnedEvent};
use crate::state::Launch;

pub mod admin {
    use anchor_lang::prelude::declare_id;

    // MetaDAO multisig vault
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ReturnFundsArgs {
    pub amount: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct ReturnFunds<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        has_one = launch_quote_vault,
        has_one = launch_signer,
    )]
    pub launch: Account<'info, Launch>,

    #[account(mut)]
    pub launch_quote_vault: Account<'info, TokenAccount>,

    /// CHECK: This is the launch signer
    #[account(
        seeds = [b"launch_signer", launch.key().as_ref()],
        bump
    )]
    pub launch_signer: UncheckedAccount<'info>,

    /// CHECK: not used, just for constraints
    pub recipient: UncheckedAccount<'info>,

    #[account(mut, associated_token::mint = launch.quote_mint, associated_token::authority = recipient)]
    pub recipient_quote_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl ReturnFunds<'_> {
    pub fn validate(&self) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(
            self.admin.key(),
            admin::ID,
            crate::error::LaunchpadError::InvalidAdmin
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: ReturnFundsArgs) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        let launch_key = launch.key();

        let seeds = &[
            b"launch_signer",
            launch_key.as_ref(),
            &[launch.launch_signer_pda_bump],
        ];
        let signer = &[&seeds[..]];

        // Transfer USDC back to the recipient
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.launch_quote_vault.to_account_info(),
                    to: ctx.accounts.recipient_quote_account.to_account_info(),
                    authority: ctx.accounts.launch_signer.to_account_info(),
                },
                signer,
            ),
            args.amount,
        )?;

        launch.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(LaunchFundsReturnedEvent {
            common: CommonFields::new(&clock, launch.seq_num),
            launch: ctx.accounts.launch.key(),
            recipient: ctx.accounts.recipient.key(),
            usdc_returned: args.amount,
        });

        Ok(())
    }
}
