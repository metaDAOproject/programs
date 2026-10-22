use super::*;

pub const SEED_ENQUEUED_MULTISIG_PROPOSAL_CANCELLATION: &[u8] = b"enqueued_cancellation";

#[account]
#[derive(InitSpace)]
pub struct EnqueuedMultisigProposalCancellation {
    pub dao: Pubkey,
    pub transaction_index: u64,
    pub pda_bump: u8,
}
