use anchor_lang::prelude::*;
use crate::state::*;
use crate::events::*;
use crate::error::TimelockError;

#[derive(Accounts)]
pub struct CreateTimelock<'info> {
    #[account(
        seeds = [timelock.key().as_ref()],
        bump,
    )]
    pub timelock_signer: SystemAccount<'info>,
    
    #[account(zero, signer)]
    pub timelock: Box<Account<'info, Timelock>>,
}

impl<'info> CreateTimelock<'info> {
    pub fn validate(
        &self,
        authority: &Pubkey,
        delay_in_slots: u64,
        enqueuers: &Vec<Pubkey>,
        enqueuer_cooldown_slots: u64,
    ) -> Result<()> {
        // Validate delay is reasonable
        require!(
            delay_in_slots > 0,
            TimelockError::InvalidDelay
        );
        
        // Validate cooldown is reasonable
        require!(
            enqueuer_cooldown_slots > 0,
            TimelockError::InvalidCooldown
        );
        
        // Limit number of initial optimistic proposers
        require!(
            enqueuers.len() <= 10,
            TimelockError::TooManyOptimisticProposers
        );
        
        // Ensure no duplicate proposers
        let mut unique_proposers = enqueuers.clone();
        unique_proposers.sort();
        unique_proposers.dedup();
        require!(
            unique_proposers.len() == enqueuers.len(),
            TimelockError::DuplicateOptimisticProposer
        );
        
        // Ensure authority is not also an optimistic proposer
        require!(
            !enqueuers.contains(authority),
            TimelockError::AuthorityCannotBeOptimisticProposer
        );
        
        Ok(())
    }
}

pub fn handler(
    ctx: Context<CreateTimelock>,
    authority: Pubkey,
    delay_in_slots: u64,
    enqueuers: Vec<Pubkey>,
    enqueuer_cooldown_slots: u64,
) -> Result<()> {
    let timelock = &mut ctx.accounts.timelock;

    timelock.authority = authority;
    timelock.delay_in_slots = delay_in_slots;
    timelock.signer_bump = ctx.bumps.timelock_signer;
    timelock.optimistic_proposers = enqueuers
        .iter()
        .map(|enq| OptimisticProposer {
            pubkey: *enq,
            last_slot_enqueued: 0,
        })
        .collect();
    timelock.optimistic_proposer_cooldown_slots = enqueuer_cooldown_slots;

    emit!(TimelockCreated {
        timelock: ctx.accounts.timelock.key(),
        authority,
        delay_in_slots,
        optimistic_proposer_cooldown_slots: enqueuer_cooldown_slots,
    });

    Ok(())
}