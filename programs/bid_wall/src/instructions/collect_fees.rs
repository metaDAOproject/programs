use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[cfg(feature = "production")]
use crate::error::BidWallError;
use crate::{
    events::{BidWallFeesCollectedEvent, CommonFields},
    metadao_multisig_vault,
    state::BidWall,
    usdc_mint,
};

pub mod metadao_cranker {
    use anchor_lang::prelude::declare_id;

    declare_id!("tSTp6B6kE9o6ZaTmHm2ZwnJBBtgd3x112tapxFhmBEQ");
}

#[event_cpi]
#[derive(Accounts)]
pub struct CollectFees<'info> {
    #[account(mut)]
    pub bid_wall: Account<'info, BidWall>,

    pub cranker: Signer<'info>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = bid_wall)]
    pub bid_wall_quote_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = metadao_multisig_vault::ID)]
    pub fee_recipient_quote_token_account: Account<'info, TokenAccount>,

    #[account(address = usdc_mint::id())]
    pub quote_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl CollectFees<'_> {
    pub fn validate(&self) -> Result<()> {
        #[cfg(feature = "production")]
        require_keys_eq!(
            self.cranker.key(),
            metadao_cranker::ID,
            BidWallError::InvalidCrankAddress
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        // transfer fees collected to fee recipient
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bid_wall_quote_token_account.to_account_info(),
                    to: ctx
                        .accounts
                        .fee_recipient_quote_token_account
                        .to_account_info(),
                    authority: ctx.accounts.bid_wall.to_account_info(),
                },
                &[&[
                    b"bid_wall",
                    ctx.accounts.bid_wall.base_mint.as_ref(),
                    ctx.accounts.bid_wall.creator.as_ref(),
                    ctx.accounts.bid_wall.nonce.to_le_bytes().as_ref(),
                    &[ctx.accounts.bid_wall.pda_bump],
                ]],
            ),
            ctx.accounts.bid_wall.fees_collected,
        )?;

        // reload bid wall quote token account to get updated amount for event
        ctx.accounts.bid_wall_quote_token_account.reload()?;
        ctx.accounts.bid_wall.seq_num += 1;

        emit_cpi!(BidWallFeesCollectedEvent {
            common: CommonFields::new(&Clock::get()?, ctx.accounts.bid_wall.seq_num),
            bid_wall: ctx.accounts.bid_wall.key(),
            fees_collected: ctx.accounts.bid_wall.fees_collected,
            post_bid_wall_quote_token_account_amount: ctx
                .accounts
                .bid_wall_quote_token_account
                .amount,
        });

        ctx.accounts.bid_wall.fees_collected = 0;

        Ok(())
    }
}
