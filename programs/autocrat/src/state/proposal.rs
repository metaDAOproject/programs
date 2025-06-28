use super::*;

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, InitSpace)]
pub enum ProposalState {
    Pending,
    Passed,
    Failed,
}

impl std::fmt::Display for ProposalState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

#[account]
#[derive(InitSpace)]
pub struct Proposal {
    pub number: u32,
    pub proposer: Pubkey,
    pub slot_enqueued: u64,
    pub state: ProposalState,
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,
    pub futarchy_amm: Pubkey,
    pub dao: Pubkey,
<<<<<<< HEAD
    pub pass_lp_tokens_locked: u64,
    pub fail_lp_tokens_locked: u64,
=======
    /// We need to include a per-proposer nonce to prevent some weird proposal
    /// front-running edge cases. Using a `u64` means that proposers are unlikely
    /// to run into collisions, even if they generate nonces randomly - I've run
    /// the math :D
    pub nonce: u64,
>>>>>>> af0016f (Get basic swap + conditional swap accounting working)
    pub pda_bump: u8,
    pub question: Pubkey,
    pub duration_in_slots: u64,
    pub squads_proposal: Pubkey,
}
