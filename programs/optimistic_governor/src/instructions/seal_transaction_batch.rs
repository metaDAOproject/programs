use anchor_lang::prelude::*;
use crate::state::*;
use crate::events::*;
use crate::instructions::UpdateTransactionBatch;

pub fn handler(ctx: Context<UpdateTransactionBatch>) -> Result<()> {
    // Get the key before the mutable borrow
    let transaction_batch_key = ctx.accounts.transaction_batch.key();
    
    let tx_batch = &mut ctx.accounts.transaction_batch;

    msg!("Current transaction batch status: {:?}", tx_batch.status);
    
    tx_batch.status = TransactionBatchStatus::Sealed;
    
    // Could emit an event here
    emit!(TransactionBatchSealed {
        transaction_batch: transaction_batch_key,  // Use the key we got earlier
        transaction_count: tx_batch.transactions.len() as u8,
    });

    Ok(())
}