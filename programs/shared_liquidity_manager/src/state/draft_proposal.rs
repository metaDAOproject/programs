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
            accounts: instruction
                .accounts
                .into_iter()
                .map(|acc| autocrat::ProposalAccount {
                    pubkey: acc.pubkey,
                    is_signer: acc.is_signer,
                    is_writable: acc.is_writable,
                })
                .collect(),
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

#[cfg(test)]
mod draft_proposal_tests {
    use super::*;

    #[test]
    pub fn test_draft_proposal_status_display() {
        assert_eq!(DraftProposalStatus::Draft.to_string(), "Draft");
        assert_eq!(DraftProposalStatus::Initialized.to_string(), "Initialized");
    }

    #[test]
    pub fn test_draft_proposal_status_equality() {
        assert_eq!(DraftProposalStatus::Draft, DraftProposalStatus::Draft);
        assert_eq!(
            DraftProposalStatus::Initialized,
            DraftProposalStatus::Initialized
        );
        assert_ne!(DraftProposalStatus::Draft, DraftProposalStatus::Initialized);
    }

    #[test]
    pub fn test_proposal_instruction_conversion() {
        let proposal_instruction = ProposalInstruction {
            program_id: Pubkey::default(),
            accounts: vec![
                ProposalAccount {
                    pubkey: Pubkey::default(),
                    is_signer: true,
                    is_writable: false,
                },
                ProposalAccount {
                    pubkey: Pubkey::default(),
                    is_signer: false,
                    is_writable: true,
                },
            ],
            data: vec![1, 2, 3, 4],
        };

        let autocrat_instruction: autocrat::ProposalInstruction =
            proposal_instruction.clone().into();

        assert_eq!(
            autocrat_instruction.program_id,
            proposal_instruction.program_id
        );
        assert_eq!(
            autocrat_instruction.accounts.len(),
            proposal_instruction.accounts.len()
        );
        assert_eq!(autocrat_instruction.data, proposal_instruction.data);
        assert_eq!(autocrat_instruction.accounts[0].is_signer, true);
        assert_eq!(autocrat_instruction.accounts[0].is_writable, false);
        assert_eq!(autocrat_instruction.accounts[1].is_signer, false);
        assert_eq!(autocrat_instruction.accounts[1].is_writable, true);
    }

    #[test]
    pub fn test_proposal_account_equality() {
        let account1 = ProposalAccount {
            pubkey: Pubkey::default(),
            is_signer: true,
            is_writable: false,
        };
        let account2 = ProposalAccount {
            pubkey: Pubkey::default(),
            is_signer: true,
            is_writable: false,
        };
        let account3 = ProposalAccount {
            pubkey: Pubkey::default(),
            is_signer: false,
            is_writable: false,
        };

        assert_eq!(account1, account2);
        assert_ne!(account1, account3);
    }
}
