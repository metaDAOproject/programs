use super::*;

pub const SEED_ENQUEUED_MULTISIG_PROPOSAL_APPROVAL: &[u8] = b"enqueued_approval";

#[account]
#[derive(InitSpace)]
pub struct EnqueuedMultisigProposalApproval {
    pub dao: Pubkey,
    pub transaction_index: u64,
    pub pda_bump: u8,
}
