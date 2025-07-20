use anchor_lang::prelude::*;

use crate::events::{CommonFields, CrankThatTwapEvent};
use crate::state::*;

#[event_cpi]
#[derive(Accounts)]
pub struct CrankThatTwap<'info> {
    #[account(mut)]
    pub amm: Account<'info, Amm>,
}

impl CrankThatTwap<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let CrankThatTwap {
            amm,
            program: _,
            event_authority: _,
        } = ctx.accounts;

        amm.update_twap(Clock::get()?.slot)?;

        amm.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(CrankThatTwapEvent {
            common: CommonFields::new(&clock, Pubkey::default(), amm),
        });

        Ok(())
    }
}
