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
    #[max_len(40)]
    pub description_url: String,
    pub slot_enqueued: u64,
    pub state: ProposalState,
    pub pass_amm: Pubkey,
    pub fail_amm: Pubkey,
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,
    pub dao: Pubkey,
    pub pass_lp_tokens_locked: u64,
    pub fail_lp_tokens_locked: u64,
    pub pda_bump: u8,
    pub question: Pubkey,
    pub duration_in_slots: u64,
    pub squads_proposal: Pubkey,
}
