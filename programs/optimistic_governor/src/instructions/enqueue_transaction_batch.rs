use anchor_lang::prelude::*;
use crate::state::*;
use crate::events::*;
use crate::instructions::EnqueueOrCancelTransactionBatch;

pub fn handler(ctx: Context<EnqueueOrCancelTransactionBatch>) -> Result<()> {
    let clock = Clock::get()?;
    let authority_key = ctx.accounts.authority.key();
    
    // Get authority type
    let authority_type = ctx.accounts.timelock.check_authority(authority_key)?;
    
    if authority_type == AuthorityType::OptimisticProposer {
        // unwrap is safe because we know the enqueuer is an enqueuer
        let enqueuer = ctx.accounts.timelock
            .optimistic_proposers
            .iter_mut()
            .find(|enq| enq.pubkey == authority_key)
            .unwrap();
        enqueuer.last_slot_enqueued = clock.slot;
    }
        
    // Update transaction batch
    msg!("Current transaction batch status: {:?}", ctx.accounts.transaction_batch.status);
    ctx.accounts.transaction_batch.status = TransactionBatchStatus::Enqueued;
    ctx.accounts.transaction_batch.enqueued_slot = clock.slot;
    ctx.accounts.transaction_batch.enqueuer_type = authority_type.clone();
    
    // Emit event
    emit!(TransactionBatchEnqueued {
        transaction_batch: ctx.accounts.transaction_batch.key(),
        authority: authority_key,
        authority_type,
        enqueued_slot: clock.slot,
    });
    
    Ok(())
}