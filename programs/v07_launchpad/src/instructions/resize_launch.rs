use anchor_lang::{prelude::*, system_program, Discriminator};

use crate::state::{Launch, OldLaunch};
use crate::ID;

#[derive(Accounts)]
pub struct ResizeLaunch<'info> {
    /// CHECK: we check the discriminator, owner, and size
    #[account(mut)]
    pub launch: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl ResizeLaunch<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let launch = &mut ctx.accounts.launch;

        // Owner check
        require_eq!(launch.owner, &ID);

        // Discriminator check
        let is_discriminator_correct =
            launch.data.try_borrow_mut().unwrap()[..8] == Launch::discriminator();
        require_eq!(is_discriminator_correct, true);

        const AFTER_REALLOC_SIZE: usize = 8 + Launch::INIT_SPACE;
        const BEFORE_REALLOC_SIZE: usize = 8 + OldLaunch::INIT_SPACE;

        // Size check
        if launch.data_len() != BEFORE_REALLOC_SIZE {
            require_eq!(launch.data_len(), AFTER_REALLOC_SIZE);
            return Ok(());
        }

        let old_data = OldLaunch::deserialize(&mut &launch.try_borrow_data().unwrap()[8..])?;

        let new_data = Launch {
            pda_bump: old_data.pda_bump,
            minimum_raise_amount: old_data.minimum_raise_amount,
            monthly_spending_limit_amount: old_data.monthly_spending_limit_amount,
            monthly_spending_limit_members: old_data.monthly_spending_limit_members,
            launch_authority: old_data.launch_authority,
            launch_signer: old_data.launch_signer,
            launch_signer_pda_bump: old_data.launch_signer_pda_bump,
            launch_quote_vault: old_data.launch_quote_vault,
            launch_base_vault: old_data.launch_base_vault,
            base_mint: old_data.base_mint,
            quote_mint: old_data.quote_mint,
            unix_timestamp_started: old_data.unix_timestamp_started,
            unix_timestamp_closed: old_data.unix_timestamp_closed,
            total_committed_amount: old_data.total_committed_amount,
            state: old_data.state,
            seq_num: old_data.seq_num,
            seconds_for_launch: old_data.seconds_for_launch,
            dao: old_data.dao,
            dao_vault: old_data.dao_vault,
            performance_package_grantee: old_data.performance_package_grantee,
            performance_package_token_amount: old_data.performance_package_token_amount,
            months_until_insiders_can_unlock: old_data.months_until_insiders_can_unlock,
            team_address: old_data.team_address,
            total_approved_amount: old_data.total_approved_amount,
            additional_tokens_amount: old_data.additional_tokens_amount,
            additional_tokens_recipient: old_data.additional_tokens_recipient,
            additional_tokens_claimed: old_data.additional_tokens_claimed,
            unix_timestamp_completed: old_data.unix_timestamp_completed,
            is_performance_package_initialized: old_data.is_performance_package_initialized,
            accumulator_activation_delay_seconds: 0,
        };

        launch.realloc(AFTER_REALLOC_SIZE, true)?;

        let lamports_needed = Rent::get()?.minimum_balance(AFTER_REALLOC_SIZE);

        if lamports_needed > launch.lamports() {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: launch.to_account_info(),
                    },
                ),
                lamports_needed - launch.lamports(),
            )?;
        }

        new_data.serialize(&mut &mut launch.try_borrow_mut_data().unwrap()[8..])?;

        Ok(())
    }
}
