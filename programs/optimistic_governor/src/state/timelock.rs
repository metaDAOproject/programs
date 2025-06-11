use anchor_lang::prelude::*;
use crate::error::TimelockError;

#[account]
pub struct Timelock {
    pub authority: Pubkey,
    pub signer_bump: u8,
    pub delay_in_slots: u64,
    pub optimistic_proposers: Vec<OptimisticProposer>,
    pub optimistic_proposer_cooldown_slots: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct OptimisticProposer {
    pub pubkey: Pubkey,
    pub last_slot_enqueued: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum AuthorityType {
    OptimisticProposer,
    TimelockAuthority,
}

impl Timelock {
    pub fn check_authority(&self, authority: Pubkey) -> Result<AuthorityType> {
        if authority == self.authority {
            Ok(AuthorityType::TimelockAuthority)
        } else if self
            .optimistic_proposers
            .iter()
            .any(|proposer| proposer.pubkey == authority)
        {
            Ok(AuthorityType::OptimisticProposer)
        } else {
            Err(TimelockError::NoAuthority.into())
        }
    }
}