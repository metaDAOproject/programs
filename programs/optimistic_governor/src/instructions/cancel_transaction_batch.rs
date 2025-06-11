use anchor_lang::prelude::*;
use crate::state::*;
use crate::events::*;
use crate::error::TimelockError;
use crate::instructions::EnqueueOrCancelTransactionBatch;

pub fn handler(ctx: Context<EnqueueOrCancelTransactionBatch>) -> Result<()> {
    let clock = Clock::get()?;
    let authority_key = ctx.accounts.authority.key();
    
    // Get authority type for the event
    let authority_type = ctx.accounts.timelock.check_authority(authority_key)?;
    
    // Store the original enqueued slot before updating
    let original_enqueued_slot = ctx.accounts.transaction_batch.enqueued_slot;
    
    // Update transaction batch status
    ctx.accounts.transaction_batch.status = TransactionBatchStatus::Cancelled;
    
    // Emit event
    emit!(TransactionBatchCancelled {
        transaction_batch: ctx.accounts.transaction_batch.key(),
        authority: authority_key,
        authority_type,
        cancelled_slot: clock.slot,
        original_enqueued_slot,
    });
    
    Ok(())
}