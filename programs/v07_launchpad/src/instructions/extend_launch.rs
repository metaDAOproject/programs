use anchor_lang::prelude::*;

use crate::error::LaunchpadError;
use crate::events::{CommonFields, LaunchExtendedEvent};
use crate::state::{Launch, LaunchState};

#[cfg(feature = "production")]
use crate::metadao_multisig_vault;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ExtendLaunchArgs {
    pub duration_seconds: u32,
}

#[event_cpi]
#[derive(Accounts)]
pub struct ExtendLaunch<'info> {
    #[account(mut)]
    pub launch: Account<'info, Launch>,

    pub admin: Signer<'info>,
}

impl ExtendLaunch<'_> {
    pub fn validate(&self, args: &ExtendLaunchArgs) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(
            self.admin.key(),
            metadao_multisig_vault::ID,
            LaunchpadError::InvalidLaunchState
        );

        require!(
            self.launch.state == LaunchState::Live,
            LaunchpadError::InvalidLaunchState
        );

        require_gt!(args.duration_seconds, 0, LaunchpadError::InvalidAmount);

        require!(
            self.launch
                .seconds_for_launch
                .checked_add(args.duration_seconds)
                .is_some(),
            LaunchpadError::ExtendDurationExceedsMax
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: ExtendLaunchArgs) -> Result<()> {
        let launch = &mut ctx.accounts.launch;
        let clock = Clock::get()?;

        let old_seconds_for_launch = launch.seconds_for_launch;

        launch.seconds_for_launch = launch
            .seconds_for_launch
            .checked_add(args.duration_seconds)
            .unwrap();

        launch.seq_num += 1;

        emit_cpi!(LaunchExtendedEvent {
            common: CommonFields::new(&clock, launch.seq_num),
            launch: launch.key(),
            old_seconds_for_launch,
            new_seconds_for_launch: launch.seconds_for_launch,
        });

        Ok(())
    }
}
