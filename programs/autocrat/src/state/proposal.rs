use super::*;

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, InitSpace)]
pub enum ProposalState {
    Pending,
    Passed,
    Failed,
    Executed,
}

impl std::fmt::Display for ProposalState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize, Debug, PartialEq, Eq)]
pub struct ProposalAccount {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize, Debug, PartialEq, Eq)]
pub struct ProposalInstruction {
    pub program_id: Pubkey,
    pub accounts: Vec<ProposalAccount>,
    pub data: Vec<u8>,
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
    /// We need to include a per-proposer nonce to prevent some weird proposal
    /// front-running edge cases. Using a `u64` means that proposers are unlikely
    /// to run into collisions, even if they generate nonces randomly - I've run
    /// the math :D
    pub nonce: u64,
    pub pda_bump: u8,
    pub question: Pubkey,
    pub duration_in_slots: u64,
    pub squads_proposal: Pubkey,
    pub final_pass_twap: Option<u128>,
    pub final_fail_twap: Option<u128>,
}

impl From<&ProposalInstruction> for Instruction {
    fn from(ix: &ProposalInstruction) -> Self {
        Self {
            program_id: ix.program_id,
            data: ix.data.clone(),
            accounts: ix.accounts.iter().map(Into::into).collect(),
        }
    }
}

impl From<&ProposalAccount> for AccountMeta {
    fn from(acc: &ProposalAccount) -> Self {
        Self {
            pubkey: acc.pubkey,
            is_signer: acc.is_signer,
            is_writable: acc.is_writable,
        }
    }
}
