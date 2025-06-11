use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::TimelockError;

#[derive(Accounts)]
pub struct EnqueueOrCancelTransactionBatch<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub timelock: Box<Account<'info, Timelock>>,
    
    #[account(
        mut,
        has_one = timelock
    )]
    pub transaction_batch: Box<Account<'info, TransactionBatch>>,
}

#[derive(Accounts)]
pub struct UpdateTransactionBatch<'info> {
    pub transaction_batch_authority: Signer<'info>,
    
    #[account(
        mut, 
        has_one = transaction_batch_authority
    )]
    pub transaction_batch: Box<Account<'info, TransactionBatch>>,
}

#[derive(Accounts)]
pub struct Auth<'info> {
    #[account(
        seeds = [timelock.key().as_ref()],
        bump = timelock.signer_bump,
    )]
    pub timelock_signer: Signer<'info>,
    
    #[account(mut)]
    pub timelock: Box<Account<'info, Timelock>>,
}

impl<'info> EnqueueOrCancelTransactionBatch<'info> {
    pub fn validate_enqueue(&self) -> Result<()> {
        // Check transaction batch status
        require!(
            self.transaction_batch.status == TransactionBatchStatus::Sealed,
            TimelockError::CannotEnqueueTransactionBatch
        );
        
        // Check authority
        let authority_type = self.timelock.check_authority(self.authority.key())?;
        
        // If optimistic proposer, check cooldown
        if authority_type == AuthorityType::OptimisticProposer {
            let clock = Clock::get()?;
            let proposer = self.timelock
                .optimistic_proposers
                .iter()
                .find(|p| p.pubkey == self.authority.key())
                .ok_or(TimelockError::NoAuthority)?;
            
            require_gte!(
                clock.slot,
                proposer
                    .last_slot_enqueued
                    .saturating_add(self.timelock.optimistic_proposer_cooldown_slots),
                TimelockError::OptimisticProposerCooldown
            );
        }
        
        Ok(())
    }
    
    pub fn validate_cancel(&self) -> Result<()> {
        // Check transaction batch status
        require!(
            self.transaction_batch.status == TransactionBatchStatus::Enqueued,
            TimelockError::CannotCancelTimelock
        );
        
        // Check we're still in the timelock period
        let clock = Clock::get()?;
        require!(
            clock.slot - self.transaction_batch.enqueued_slot < self.timelock.delay_in_slots,
            TimelockError::CanOnlyCancelDuringTimelockPeriod
        );
        
        // Check authority permissions
        let authority_type = self.timelock.check_authority(self.authority.key())?;
        
        // Only timelock authority can cancel transactions enqueued by timelock authority
        if self.transaction_batch.enqueuer_type == AuthorityType::TimelockAuthority {
            require!(
                authority_type == AuthorityType::TimelockAuthority,
                TimelockError::InsufficientPermissions
            );
        }
        
        Ok(())
    }
}

impl<'info> UpdateTransactionBatch<'info> {
    pub fn validate_add_transaction(&self) -> Result<()> {
        require!(
            self.transaction_batch.status == TransactionBatchStatus::Created,
            TimelockError::CannotAddTransactions
        );
        Ok(())
    }
    
    pub fn validate_seal(&self) -> Result<()> {
        require!(
            self.transaction_batch.status == TransactionBatchStatus::Created,
            TimelockError::CannotSealTransactionBatch
        );
        Ok(())
    }
}

impl<'info> Auth<'info> {
    pub fn validate_set_delay(&self, delay_in_slots: u64) -> Result<()> {
        require!(
            delay_in_slots > 0,
            TimelockError::InvalidDelay
        );
        Ok(())
    }
    
    pub fn validate_set_authority(&self, authority: &Pubkey) -> Result<()> {
        // Could add validation like ensuring authority is not in optimistic_proposers
        require!(
            !self.timelock.optimistic_proposers
                .iter()
                .any(|p| p.pubkey == *authority),
            TimelockError::AuthorityCannotBeOptimisticProposer
        );
        Ok(())
    }
    
    pub fn validate_set_cooldown(&self, cooldown_slots: u64) -> Result<()> {
        require!(
            cooldown_slots > 0,
            TimelockError::InvalidCooldown
        );
        Ok(())
    }
    
    pub fn validate_add_optimistic_proposer(&self, enqueuer: &Pubkey) -> Result<()> {
        // Check max proposers limit
        require!(
            self.timelock.optimistic_proposers.len() < 10,
            TimelockError::TooManyOptimisticProposers
        );
        
        // Ensure not adding the authority as proposer
        require!(
            *enqueuer != self.timelock.authority,
            TimelockError::AuthorityCannotBeOptimisticProposer
        );
        
        Ok(())
    }
    
    pub fn validate_remove_optimistic_proposer(&self) -> Result<()> {
        // Could add validation like ensuring at least one proposer remains
        // or other business logic
        Ok(())
    }
}