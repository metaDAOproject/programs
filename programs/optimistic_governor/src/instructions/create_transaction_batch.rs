use anchor_lang::prelude::*;
use crate::state::*;
use crate::events::*;

#[derive(Accounts)]
pub struct CreateTransactionBatch<'info> {
    #[account(mut)]
    pub transaction_batch_authority: Signer<'info>,
    
    pub timelock: Box<Account<'info, Timelock>>,
    
    #[account(zero, signer)]
    pub transaction_batch: Box<Account<'info, TransactionBatch>>,
}

impl<'info> CreateTransactionBatch<'info> {
    pub fn validate(&self) -> Result<()> {
        // Could add validation here, for example:
        // - Check if the authority is allowed to create batches
        // - Check if timelock is in a valid state
        // For now, no specific validation needed
        Ok(())
    }
}

pub fn handler(ctx: Context<CreateTransactionBatch>) -> Result<()> {
    let tx_batch = &mut ctx.accounts.transaction_batch;

    tx_batch.timelock = ctx.accounts.timelock.key();
    tx_batch.transaction_batch_authority = ctx.accounts.transaction_batch_authority.key();
    tx_batch.status = TransactionBatchStatus::Created;
    tx_batch.transactions = vec![]; // Initialize empty transactions vector
    tx_batch.enqueued_slot = 0; // Will be set when enqueued
    tx_batch.enqueuer_type = AuthorityType::TimelockAuthority; // Default, will be updated on enqueue

    emit!(TransactionBatchCreated {
        transaction_batch: ctx.accounts.transaction_batch.key(),
        transaction_batch_authority: ctx.accounts.transaction_batch_authority.key(),
        timelock: ctx.accounts.timelock.key(),
    });

    Ok(())
}