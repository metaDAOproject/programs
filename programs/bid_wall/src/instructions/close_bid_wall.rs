use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    error::BidWallError,
    events::{BidWallClosedEvent, CommonFields},
    metadao_multisig_vault,
    state::BidWall,
    usdc_mint,
};

#[event_cpi]
#[derive(Accounts)]
pub struct CloseBidWall<'info> {
    #[account(
        mut,
        close=authority,
        has_one = authority
    )]
    pub bid_wall: Account<'info, BidWall>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: used for constraints
    #[account(mut, address = bid_wall.authority)]
    pub authority: UncheckedAccount<'info>,

    /// CHECK: the fee recipient is always the metadao multisig vault
    #[account(address = metadao_multisig_vault::ID)]
    pub fee_recipient: UncheckedAccount<'info>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = bid_wall)]
    pub bid_wall_quote_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = authority)]
    pub authority_quote_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = fee_recipient)]
    pub fee_recipient_quote_token_account: Account<'info, TokenAccount>,

    #[account(address = bid_wall.base_mint)]
    pub base_mint: Account<'info, Mint>,

    #[account(address = usdc_mint::id())]
    pub quote_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// TODO: Theoretically, we could merge the logic of this instruction with the cancel bid wall instruction.
impl CloseBidWall<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        // We can close the bid wall if it is depleted, thus only need to check expiration if it is not depleted.
        if self.bid_wall.quote_amount > 0 {
            // Only allow closing the bid wall if it has been open for at least the minimum duration.
            require_gt!(
                clock.unix_timestamp,
                self.bid_wall
                    .created_timestamp
                    .checked_add(self.bid_wall.duration_seconds as i64)
                    .unwrap(),
                BidWallError::BidWallNotExpired
            );
        }

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
                    ctx.accounts.base_mint.key().as_ref(),
                    ctx.accounts.bid_wall.creator.as_ref(),
                    ctx.accounts.bid_wall.nonce.to_le_bytes().as_ref(),
                    &[ctx.accounts.bid_wall.pda_bump],
                ]],
            ),
            ctx.accounts.bid_wall.fees_collected,
        )?;

        ctx.accounts.bid_wall_quote_token_account.reload()?;

        // transfer all remaining quote tokens in bid wall quote ATA back to authority
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.bid_wall_quote_token_account.to_account_info(),
                    to: ctx.accounts.authority_quote_token_account.to_account_info(),
                    authority: ctx.accounts.bid_wall.to_account_info(),
                },
                &[&[
                    b"bid_wall",
                    ctx.accounts.base_mint.key().as_ref(),
                    ctx.accounts.bid_wall.creator.as_ref(),
                    ctx.accounts.bid_wall.nonce.to_le_bytes().as_ref(),
                    &[ctx.accounts.bid_wall.pda_bump],
                ]],
            ),
            ctx.accounts.bid_wall_quote_token_account.amount,
        )?;

        // Close the bid wall quote ATA
        token::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::CloseAccount {
                account: ctx.accounts.bid_wall_quote_token_account.to_account_info(),
                destination: ctx.accounts.authority.to_account_info(),
                authority: ctx.accounts.bid_wall.to_account_info(),
            },
            &[&[
                b"bid_wall",
                ctx.accounts.base_mint.key().as_ref(),
                ctx.accounts.bid_wall.creator.as_ref(),
                ctx.accounts.bid_wall.nonce.to_le_bytes().as_ref(),
                &[ctx.accounts.bid_wall.pda_bump],
            ]],
        ))?;

        ctx.accounts.bid_wall.seq_num += 1;

        emit_cpi!(BidWallClosedEvent {
            common: CommonFields::new(&Clock::get()?, ctx.accounts.bid_wall.seq_num),
            bid_wall: ctx.accounts.bid_wall.key(),
        });

        // Bid wall account gets closed using close constraint

        Ok(())
    }
}
