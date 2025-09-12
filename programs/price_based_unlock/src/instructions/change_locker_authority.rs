use anchor_lang::prelude::*;
use crate::{Locker, PriceBasedUnlockError};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ChangeLockerAuthorityParams {
    pub new_locker_authority: Pubkey,
}

#[derive(Accounts)]
pub struct ChangeLockerAuthority<'info> {
    #[account(mut)]
    pub locker: Account<'info, Locker>,
    
    /// Only the current locker authority can change the locker authority
    pub current_authority: Signer<'info>,
}

impl<'info> ChangeLockerAuthority<'info> {
    pub fn validate(&self) -> Result<()> {
        // Validate that the signer is the current locker authority
        if self.current_authority.key() != self.locker.locker_authority {
            return Err(PriceBasedUnlockError::UnauthorizedLockerAuthority.into());
        }
        
        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: ChangeLockerAuthorityParams) -> Result<()> {
        let Self {
            locker,
            current_authority: _,
        } = ctx.accounts;
        
        let ChangeLockerAuthorityParams {
            new_locker_authority,
        } = params;
        
        let clock = Clock::get()?;
        let old_authority = locker.locker_authority;
        
        // Update the locker authority
        locker.locker_authority = new_locker_authority;
        
        // Emit event
        emit!(crate::events::LockerAuthorityChanged {
            locker: locker.key(),
            old_authority,
            new_authority: new_locker_authority,
            changed_at: clock.unix_timestamp,
        });
        
        Ok(())
    }
}