use anchor_lang::prelude::*;
use anchor_lang::solana_program::{self, instruction::Instruction};
use std::ops::Deref;
use crate::state::*;
use crate::events::*;
use crate::error::TimelockError;

#[derive(Accounts)]
pub struct ExecuteTransactionBatch<'info> {
    #[account(
        seeds = [timelock.key().as_ref()],
        bump = timelock.signer_bump,
    )]
    pub timelock_signer: SystemAccount<'info>,
    
    pub timelock: Box<Account<'info, Timelock>>,
    
    #[account(
        mut, 
        has_one = timelock
    )]
    pub transaction_batch: Box<Account<'info, TransactionBatch>>,
}

impl<'info> ExecuteTransactionBatch<'info> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;
        
        // Check status
        require!(
            self.transaction_batch.status == TransactionBatchStatus::Enqueued,
            TimelockError::CannotExecuteTransactions
        );
        
        // Check timelock delay has passed
        let enqueued_slot = self.transaction_batch.enqueued_slot;
        let required_delay = self.timelock.delay_in_slots;
        require!(
            clock.slot - enqueued_slot > required_delay,
            TimelockError::NotReady
        );
        
        Ok(())
    }
}

pub fn handler(ctx: Context<ExecuteTransactionBatch>) -> Result<()> {
    let tx_batch = &mut ctx.accounts.transaction_batch;
    
    msg!("Current transaction batch status: {:?}", tx_batch.status);
    
    // Find and execute the next unexecuted transaction
    if let Some(transaction) = tx_batch.transactions.iter_mut().find(|tx| !tx.did_execute) {
        // Convert transaction to instruction
        let mut ix: Instruction = transaction.deref().into();
        
        // Update signer if it's the timelock PDA
        for acc in ix.accounts.iter_mut() {
            if &acc.pubkey == ctx.accounts.timelock_signer.key {
                acc.is_signer = true;
            }
        }
        
        // Prepare PDA signer seeds
        let timelock_key = ctx.accounts.timelock.key();
        let seeds = &[timelock_key.as_ref(), &[ctx.accounts.timelock.signer_bump]];
        let signer = &[&seeds[..]];
        
        // Execute the instruction
        let accounts = ctx.remaining_accounts;
        solana_program::program::invoke_signed(&ix, accounts, signer)?;
        
        // Mark transaction as executed
        transaction.did_execute = true;
        
        msg!("Executed transaction to program: {}", transaction.program_id);
    }
    
    // Check if all transactions are complete
    if tx_batch.transactions.iter().all(|tx| tx.did_execute) {
        tx_batch.status = TransactionBatchStatus::Executed;
        
        emit!(TransactionBatchExecuted {
            transaction_batch: ctx.accounts.transaction_batch.key(),
            executed_slot: Clock::get()?.slot,
        });
    }
    
    Ok(())
}