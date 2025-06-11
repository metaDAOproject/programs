use anchor_lang::prelude::*;
use crate::state::*;
use crate::instructions::UpdateTransactionBatch;

pub fn handler(
    ctx: Context<UpdateTransactionBatch>,
    program_id: Pubkey,
    accounts: Vec<TransactionAccount>,
    data: Vec<u8>,
) -> Result<()> {
    let tx_batch = &mut ctx.accounts.transaction_batch;

    msg!("Current transaction batch status: {:?}", tx_batch.status);
    
    let this_transaction = Transaction {
        program_id,
        accounts,
        data,
        did_execute: false,
    };

    tx_batch.transactions.push(this_transaction);


    Ok(())
}