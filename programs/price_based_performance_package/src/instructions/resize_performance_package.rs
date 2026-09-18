use anchor_lang::error::ErrorCode;
use anchor_lang::{system_program, Discriminator};

use super::*;

#[derive(Accounts)]
pub struct ResizePerformancePackage<'info> {
    /// CHECK: owner and discriminator are checked in `validate`
    #[account(mut)]
    pub performance_package: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl ResizePerformancePackage<'_> {
    pub fn validate(&self) -> Result<()> {
        require_keys_eq!(
            *self.performance_package.owner,
            crate::ID,
            ErrorCode::AccountOwnedByWrongProgram
        );

        let data = self.performance_package.try_borrow_data()?;
        require_gte!(data.len(), 8, ErrorCode::AccountDiscriminatorNotFound);
        require!(
            data[..8] == PerformancePackage::discriminator(),
            ErrorCode::AccountDiscriminatorMismatch
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let performance_package = &ctx.accounts.performance_package;

        // Already migrated; idempotent so the migration script can be re-run.
        if performance_package.data_len() == PerformancePackage::SIZE {
            return Ok(());
        }

        require_eq!(
            performance_package.data_len(),
            PerformancePackage::OLD_SIZE,
            ErrorCode::AccountDidNotDeserialize
        );

        let old = OldPerformancePackage::deserialize(
            &mut &performance_package.try_borrow_data()?[8..],
        )?;

        let new = PerformancePackage {
            tranches: old.tranches,
            total_token_amount: old.total_token_amount,
            already_unlocked_amount: old.already_unlocked_amount,
            min_unlock_timestamp: old.min_unlock_timestamp,
            oracle_config: old.oracle_config,
            twap_length_seconds: old.twap_length_seconds,
            recipient: old.recipient,
            state: old.state,
            create_key: old.create_key,
            pda_bump: old.pda_bump,
            performance_package_authority: old.performance_package_authority,
            token_mint: old.token_mint,
            seq_num: old.seq_num,
            performance_package_token_vault: old.performance_package_token_vault,
            withdrawal_policy: None,
        };

        performance_package.realloc(PerformancePackage::SIZE, true)?;

        let lamports_needed = Rent::get()?.minimum_balance(PerformancePackage::SIZE);
        if lamports_needed > performance_package.lamports() {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: performance_package.to_account_info(),
                    },
                ),
                lamports_needed - performance_package.lamports(),
            )?;
        }

        new.serialize(&mut &mut performance_package.try_borrow_mut_data()?[8..])?;

        Ok(())
    }
}
