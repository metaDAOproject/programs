use anchor_lang::{prelude::*, system_program, Discriminator};

use crate::state::{FundingRecord, OldFundingRecord};
use crate::ID;

#[derive(Accounts)]
pub struct ResizeFundingRecord<'info> {
    /// CHECK: we check the discriminator, owner, and size
    #[account(mut)]
    pub funding_record: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl ResizeFundingRecord<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let funding_record = &mut ctx.accounts.funding_record;

        // Owner check
        require_eq!(funding_record.owner, &ID);

        // Discriminator check
        let is_discriminator_correct =
            funding_record.data.try_borrow_mut().unwrap()[..8] == FundingRecord::discriminator();
        require_eq!(is_discriminator_correct, true);

        const AFTER_REALLOC_SIZE: usize = 8 + FundingRecord::INIT_SPACE;
        const BEFORE_REALLOC_SIZE: usize = 8 + OldFundingRecord::INIT_SPACE;

        // Size check
        if funding_record.data_len() != BEFORE_REALLOC_SIZE {
            require_eq!(funding_record.data_len(), AFTER_REALLOC_SIZE);
            return Ok(());
        }

        let old_data =
            OldFundingRecord::deserialize(&mut &funding_record.try_borrow_data().unwrap()[8..])?;

        let new_data = FundingRecord {
            pda_bump: old_data.pda_bump,
            funder: old_data.funder,
            launch: old_data.launch,
            committed_amount: old_data.committed_amount,
            is_tokens_claimed: old_data.is_tokens_claimed,
            is_usdc_refunded: old_data.is_usdc_refunded,
            approved_amount: old_data.approved_amount,
            committed_amount_accumulator: 0,
            last_accumulator_update: 0,
        };

        funding_record.realloc(AFTER_REALLOC_SIZE, true)?;

        let lamports_needed = Rent::get()?.minimum_balance(AFTER_REALLOC_SIZE);

        if lamports_needed > funding_record.lamports() {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: funding_record.to_account_info(),
                    },
                ),
                lamports_needed - funding_record.lamports(),
            )?;
        }

        new_data.serialize(&mut &mut funding_record.try_borrow_mut_data().unwrap()[8..])?;

        Ok(())
    }
}
