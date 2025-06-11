use anchor_lang::prelude::*;

#[error_code]
pub enum TimelockError {
    #[msg("This transaction is not yet ready to be executed")]
    NotReady,
    #[msg("Can only add instructions when transaction batch status is `Created`")]
    CannotAddTransactions,
    #[msg("Can only seal the transaction batch when status is `Created`")]
    CannotSealTransactionBatch,
    #[msg("Can only enqueue the timelock running once the status is `Sealed`")]
    CannotEnqueueTransactionBatch,
    #[msg("Can only cancel the transactions if the status `Enqueued`")]
    CannotCancelTimelock,
    #[msg("Can only cancel the transactions during the timelock period")]
    CanOnlyCancelDuringTimelockPeriod,
    #[msg("Can only execute the transactions if the status is `Enqueued`")]
    CannotExecuteTransactions,
    #[msg("The signer is neither the timelock authority nor an optimistic proposer")]
    NoAuthority,
    #[msg("Optimistic proposers can't cancel transaction batches enqueued by the timelock authority")]
    InsufficientPermissions,
    #[msg("This optimistic proposer is still in its cooldown period")]
    OptimisticProposerCooldown,
    #[msg("Delay must be greater than 0")]
    InvalidDelay,
    #[msg("Cooldown must be greater than 0")]
    InvalidCooldown,
    #[msg("Too many optimistic proposers")]
    TooManyOptimisticProposers,
    #[msg("Duplicate optimistic proposer")]
    DuplicateOptimisticProposer,
    #[msg("Authority cannot also be an optimistic proposer")]
    AuthorityCannotBeOptimisticProposer,
}