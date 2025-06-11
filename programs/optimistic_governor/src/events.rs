use anchor_lang::prelude::*;
use crate::state::AuthorityType;

#[event]
pub struct TimelockCreated {
    pub timelock: Pubkey,
    pub authority: Pubkey,
    pub delay_in_slots: u64,
    pub optimistic_proposer_cooldown_slots: u64,
}

#[event]
pub struct TransactionBatchCreated {
    pub transaction_batch: Pubkey,
    pub transaction_batch_authority: Pubkey,
    pub timelock: Pubkey,
}

#[event]
pub struct TransactionBatchSealed {
    pub transaction_batch: Pubkey,
    pub transaction_count: u8,
}

#[event]
pub struct TransactionBatchEnqueued {
    pub transaction_batch: Pubkey,
    pub authority: Pubkey,
    pub authority_type: AuthorityType,
    pub enqueued_slot: u64,
}

#[event]
pub struct TransactionBatchCancelled {
    pub transaction_batch: Pubkey,
    pub authority: Pubkey,
    pub authority_type: AuthorityType,
    pub cancelled_slot: u64,
    pub original_enqueued_slot: u64,
}

#[event]
pub struct TransactionBatchExecuted {
    pub transaction_batch: Pubkey,
    pub executed_slot: u64,
}

#[event]
pub struct DelayUpdated {
    pub timelock: Pubkey,
    pub old_delay: u64,
    pub new_delay: u64,
}

#[event]
pub struct AuthorityUpdated {
    pub timelock: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct OptimisticProposerAdded {
    pub timelock: Pubkey,
    pub optimistic_proposer: Pubkey,
}

#[event]
pub struct OptimisticProposerRemoved {
    pub timelock: Pubkey,
    pub optimistic_proposer: Pubkey,
}

#[event]
pub struct OptimisticProposerCooldownUpdated {
    pub timelock: Pubkey,
    pub old_cooldown: u64,
    pub new_cooldown: u64,
}

#[event]
pub struct TransactionAdded {
    pub transaction_batch: Pubkey,
    pub transaction_index: u8,
    pub program_id: Pubkey,
}