pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("GP3gUFqHgdz9tB5bosCqmnu7qnkFa1gjUMFs8uCkwWQr");

#[program]
pub mod price_based_unlock {
    use super::*;

    pub fn initialize_locker(
        ctx: Context<InitializeLocker>,
        params: InitializeLockerParams,
    ) -> Result<()> {
        InitializeLocker::handle(ctx, params)
    }

    pub fn start_unlock(ctx: Context<StartUnlock>) -> Result<()> {
        StartUnlock::handle(ctx)
    }

    pub fn complete_unlock(ctx: Context<CompleteUnlock>) -> Result<()> {
        CompleteUnlock::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn propose_change(
        ctx: Context<ProposeChange>,
        params: ProposeChangeParams,
    ) -> Result<()> {
        ProposeChange::handle(ctx, params)
    }

    pub fn execute_change(ctx: Context<ExecuteChange>) -> Result<()> {
        ExecuteChange::handle(ctx)
    }
}
