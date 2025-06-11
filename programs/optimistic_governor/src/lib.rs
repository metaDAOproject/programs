use anchor_lang::prelude::*;
#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

pub use error::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "optimistic_timelock",
    project_url: "https://metadao.fi",
    contacts: "email:metaproph3t@protonmail.com",
    policy: "The market will decide whether we pay a bug bounty.",
    source_code: "https://github.com/metaDAOproject/futarchy",
    source_release: "v0.4",
    auditors: "None",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("tiME1hz9F5C5ZecbvE5z6Msjy8PKfTqo1UuRYXfndKF");

#[program]
pub mod optimistic_timelock {
    use super::*;

    #[access_control(ctx.accounts.validate(&authority, delay_in_slots, &enqueuers, enqueuer_cooldown_slots))]
    pub fn create_timelock(
        ctx: Context<CreateTimelock>,
        authority: Pubkey,
        delay_in_slots: u64,
        enqueuers: Vec<Pubkey>,
        enqueuer_cooldown_slots: u64,
    ) -> Result<()> {
        instructions::create_timelock::handler(
            ctx,
            authority,
            delay_in_slots,
            enqueuers,
            enqueuer_cooldown_slots,
        )
    }

    #[access_control(ctx.accounts.validate_set_delay(delay_in_slots))]
    pub fn set_delay_in_slots(ctx: Context<Auth>, delay_in_slots: u64) -> Result<()> {
        instructions::set_delay_in_slots::handler(ctx, delay_in_slots)
    }
    
    #[access_control(ctx.accounts.validate_set_authority(&authority))]
    pub fn set_authority(ctx: Context<Auth>, authority: Pubkey) -> Result<()> {
        instructions::set_authority::handler(ctx, authority)
    }
    
    #[access_control(ctx.accounts.validate_set_cooldown(cooldown_slots))]
    pub fn set_optimistic_proposer_cooldown_slots(
        ctx: Context<Auth>,
        cooldown_slots: u64,
    ) -> Result<()> {
        instructions::set_optimistic_proposer_cooldown_slots::handler(ctx, cooldown_slots)
    }
    
    #[access_control(ctx.accounts.validate_add_optimistic_proposer(&enqueuer))]
    pub fn add_optimistic_proposer(ctx: Context<Auth>, enqueuer: Pubkey) -> Result<()> {
        instructions::add_optimistic_proposer::handler(ctx, enqueuer)
    }
    
    #[access_control(ctx.accounts.validate_remove_optimistic_proposer())]
    pub fn remove_optimistic_proposer(
        ctx: Context<Auth>,
        optimistic_proposer: Pubkey,
    ) -> Result<()> {
        instructions::remove_optimistic_proposer::handler(ctx, optimistic_proposer)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn create_transaction_batch(ctx: Context<CreateTransactionBatch>) -> Result<()> {
        instructions::create_transaction_batch::handler(ctx)
    }

    #[access_control(ctx.accounts.validate_add_transaction())]
    pub fn add_transaction(
        ctx: Context<UpdateTransactionBatch>,
        program_id: Pubkey,
        accounts: Vec<TransactionAccount>,
        data: Vec<u8>,
    ) -> Result<()> {
        instructions::add_transaction::handler(ctx, program_id, accounts, data)
    }
    
    #[access_control(ctx.accounts.validate_seal())]
    pub fn seal_transaction_batch(ctx: Context<UpdateTransactionBatch>) -> Result<()> {
        instructions::seal_transaction_batch::handler(ctx)
    }

    #[access_control(ctx.accounts.validate_enqueue())]
    pub fn enqueue_transaction_batch(ctx: Context<EnqueueOrCancelTransactionBatch>) -> Result<()> {
        instructions::enqueue_transaction_batch::handler(ctx)
    }

    #[access_control(ctx.accounts.validate_cancel())]
    pub fn cancel_transaction_batch(ctx: Context<EnqueueOrCancelTransactionBatch>) -> Result<()> {
        instructions::cancel_transaction_batch::handler(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn execute_transaction_batch(ctx: Context<ExecuteTransactionBatch>) -> Result<()> {
        instructions::execute_transaction_batch::handler(ctx)
    }
}