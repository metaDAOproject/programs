use std::cmp::Ordering;

use anchor_lang::prelude::*;

use crate::{
    error::LiquidationError,
    events::{CommonFields, RefundRecordSetEvent},
    state::{Liquidation, RefundRecord, SEED_REFUND_RECORD},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SetRefundRecordArgs {
    pub base_assigned: u64,
    pub quote_refundable: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct SetRefundRecord<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub record_authority: Signer<'info>,

    #[account(
        mut,
        constraint = liquidation.record_authority == record_authority.key() @ LiquidationError::InvalidAuthority,
    )]
    pub liquidation: Account<'info, Liquidation>,

    /// CHECK: The user this record is for. Does not need to sign.
    pub recipient: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + RefundRecord::INIT_SPACE,
        seeds = [SEED_REFUND_RECORD, liquidation.key().as_ref(), recipient.key().as_ref()],
        bump,
    )]
    pub refund_record: Account<'info, RefundRecord>,

    pub system_program: Program<'info, System>,
}

impl SetRefundRecord<'_> {
    pub fn validate(&self, args: &SetRefundRecordArgs) -> Result<()> {
        // Records can only be set during the setup phase
        require!(
            !self.liquidation.is_refunding,
            LiquidationError::AlreadyActivated
        );

        // If quote is allocated but base_assigned is zero, the user can never burn tokens
        // to claim their quote — funds would be locked until post-deadline withdrawal
        if args.quote_refundable > 0 {
            require_gt!(args.base_assigned, 0, LiquidationError::InvalidAllocation);
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: SetRefundRecordArgs) -> Result<()> {
        let clock = Clock::get()?;
        let liquidation = &mut ctx.accounts.liquidation;
        let refund_record = &mut ctx.accounts.refund_record;

        // Adjust liquidation totals based on diff
        match args.base_assigned.cmp(&refund_record.base_assigned) {
            Ordering::Greater => {
                liquidation.total_base_assigned += args.base_assigned - refund_record.base_assigned;
            }
            Ordering::Less => {
                liquidation.total_base_assigned -= refund_record.base_assigned - args.base_assigned;
            }
            Ordering::Equal => {}
        }

        match args.quote_refundable.cmp(&refund_record.quote_refundable) {
            Ordering::Greater => {
                liquidation.total_quote_refundable +=
                    args.quote_refundable - refund_record.quote_refundable;
            }
            Ordering::Less => {
                liquidation.total_quote_refundable -=
                    refund_record.quote_refundable - args.quote_refundable;
            }
            Ordering::Equal => {}
        }

        // Set refund record fields
        refund_record.liquidation = liquidation.key();
        refund_record.recipient = ctx.accounts.recipient.key();
        refund_record.base_assigned = args.base_assigned;
        refund_record.quote_refundable = args.quote_refundable;
        refund_record.base_burned = 0;
        refund_record.quote_refunded = 0;
        refund_record.pda_bump = ctx.bumps.refund_record;

        // Emit event
        liquidation.seq_num += 1;

        emit_cpi!(RefundRecordSetEvent {
            common: CommonFields::new(&clock, liquidation.seq_num),
            liquidation: liquidation.key(),
            refund_record: ctx.accounts.refund_record.key(),
            recipient: ctx.accounts.recipient.key(),
            base_assigned: args.base_assigned,
            quote_refundable: args.quote_refundable,
            liquidation_total_base_assigned: liquidation.total_base_assigned,
            liquidation_total_quote_refundable: liquidation.total_quote_refundable,
            pda_bump: ctx.bumps.refund_record,
        });

        Ok(())
    }
}
