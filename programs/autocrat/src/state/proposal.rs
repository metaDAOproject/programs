use super::*;

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, InitSpace)]
pub enum ProposalState {
    Draft { amount_staked: u64 },
    Pending,
    Passed,
    Failed,
}

impl std::fmt::Display for ProposalState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub struct StakerRecord {
    pub staker: Pubkey,
    pub amount: u64,
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
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,
    pub dao: Pubkey,
    pub pda_bump: u8,
    pub question: Pubkey,
    pub duration_in_slots: u64,
    pub squads_proposal: Pubkey,
    pub pass_base_mint: Pubkey,
    pub pass_quote_mint: Pubkey,
    pub fail_base_mint: Pubkey,
    pub fail_quote_mint: Pubkey,
    /// Mapping of staker to amount staked (only used in Draft state)
    #[max_len(100)]
    pub stakers: Vec<StakerRecord>,
}
