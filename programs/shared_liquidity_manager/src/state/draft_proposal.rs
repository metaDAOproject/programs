use anchor_lang::prelude::*;

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

impl From<ProposalInstruction> for autocrat::ProposalInstruction {
    fn from(instruction: ProposalInstruction) -> Self {
        Self {
            program_id: instruction.program_id,
            accounts: instruction.accounts.into_iter().map(|acc| autocrat::ProposalAccount {
                pubkey: acc.pubkey,
                is_signer: acc.is_signer,
                is_writable: acc.is_writable,
            }).collect(),
            data: instruction.data,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, PartialEq, Eq, Clone, Copy)]
pub enum DraftProposalStatus {
    Draft,
    Initialized,
}

impl std::fmt::Display for DraftProposalStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

#[account]
pub struct DraftProposal {
    pub shared_liquidity_pool: Pubkey,
    pub base_mint: Pubkey,
    pub instruction: ProposalInstruction,
    pub status: DraftProposalStatus,
    /// The amount of tokens that have been staked on this draft proposal
    pub staked_token_amount: u64,
    /// The vault that holds the staked tokens
    pub staked_token_vault: Pubkey,
    /// The nonce used to create this draft proposal PDA
    pub nonce: u64,
    pub pda_bump: u8,
}