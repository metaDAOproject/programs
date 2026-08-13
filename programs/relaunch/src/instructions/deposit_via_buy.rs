use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use anchor_spl::token_interface;

use crate::error::RelaunchError;
use crate::events::{CommonFields, TokensDepositedViaBuyEvent};
use crate::pump_amm;
use crate::state::{DepositRecord, Relaunch, RelaunchState, SourceVenue};
use crate::{
    pump_amm_event_authority, pump_amm_fee_config, pump_amm_global_config, pump_amm_program,
    pump_fees_program,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DepositViaBuyArgs {
    /// The exact amount of old tokens to buy off the source pool (pump's buy
    /// is exact-output).
    pub base_out: u64,
    /// The depositor's live slippage cap on the quote spent, inclusive of
    /// pump's fees.
    pub max_quote_in: u64,
}

#[event_cpi]
#[derive(Accounts)]
pub struct DepositViaBuy<'info> {
    #[account(
        mut,
        has_one = old_mint,
        has_one = source_quote_mint,
        has_one = source_pool,
        has_one = relaunch_signer,
        has_one = old_token_vault,
        has_one = source_quote_vault,
    )]
    pub relaunch: Box<Account<'info, Relaunch>>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + DepositRecord::INIT_SPACE,
        seeds = [b"deposit_record", relaunch.key().as_ref(), depositor.key().as_ref()],
        bump
    )]
    pub deposit_record: Box<Account<'info, DepositRecord>>,

    pub depositor: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: the vault authority that signs the buy; pump_amm requires the
    /// user account writable.
    #[account(mut)]
    pub relaunch_signer: UncheckedAccount<'info>,

    #[account(mint::token_program = base_token_program)]
    pub old_mint: Box<InterfaceAccount<'info, token_interface::Mint>>,

    pub source_quote_mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub old_token_vault: Box<InterfaceAccount<'info, token_interface::TokenAccount>>,

    #[account(mut)]
    pub source_quote_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = source_quote_mint,
        token::authority = depositor,
    )]
    pub depositor_quote_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: fingerprint-validated at init and pinned by has_one
    #[account(mut)]
    pub source_pool: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = pump_amm_global_config::id())]
    pub pump_global_config: UncheckedAccount<'info>,

    /// CHECK: pump_amm requires membership in its global config
    pub protocol_fee_recipient: UncheckedAccount<'info>,

    /// CHECK: pump_amm checks this ATA
    #[account(mut)]
    pub protocol_fee_recipient_token_account: UncheckedAccount<'info>,

    /// CHECK: pump_amm checks this against the pool's stored field
    #[account(mut)]
    pub pool_base_token_account: UncheckedAccount<'info>,

    /// CHECK: pump_amm checks this against the pool's stored field
    #[account(mut)]
    pub pool_quote_token_account: UncheckedAccount<'info>,

    /// CHECK: pump_amm derives this from the pool's coin_creator
    #[account(mut)]
    pub coin_creator_vault_ata: UncheckedAccount<'info>,

    /// CHECK: pump_amm derives this from the pool's coin_creator
    pub coin_creator_vault_authority: UncheckedAccount<'info>,

    /// CHECK: pump_amm address-checks this PDA
    pub global_volume_accumulator: UncheckedAccount<'info>,

    /// CHECK: pump_amm address-checks this PDA; created for `relaunch_signer`
    /// on the first buy
    #[account(mut)]
    pub user_volume_accumulator: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = pump_amm_fee_config::id())]
    pub pump_fee_config: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = pump_fees_program::id())]
    pub pump_fee_program: UncheckedAccount<'info>,

    /// CHECK: pump_amm address-checks this PDA (it need not exist)
    pub pool_v2: UncheckedAccount<'info>,

    /// CHECK: pump_amm requires membership in its global config's buyback list
    pub buyback_fee_recipient: UncheckedAccount<'info>,

    /// CHECK: pump_amm checks this ATA
    #[account(mut)]
    pub buyback_fee_recipient_token_account: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = pump_amm_event_authority::id())]
    pub pump_event_authority: UncheckedAccount<'info>,

    /// CHECK: fixed address
    #[account(address = pump_amm_program::id())]
    pub pump_amm_program: UncheckedAccount<'info>,

    pub base_token_program: Interface<'info, token_interface::TokenInterface>,
    pub quote_token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl DepositViaBuy<'_> {
    pub fn validate(&self, args: &DepositViaBuyArgs) -> Result<()> {
        require!(
            self.relaunch.state == RelaunchState::Live,
            RelaunchError::RelaunchNotLive
        );

        require!(
            self.relaunch.source_venue == SourceVenue::PumpSwap,
            RelaunchError::WrongSourceVenue
        );

        let clock = Clock::get()?;
        require_gt!(
            self.relaunch.unix_timestamp_started.unwrap()
                + self.relaunch.seconds_for_deposits as i64,
            clock.unix_timestamp,
            RelaunchError::DepositWindowClosed
        );

        require_gt!(args.base_out, 0, RelaunchError::InvalidAmount);
        require_gt!(args.max_quote_in, 0, RelaunchError::InvalidAmount);

        require_gte!(
            self.depositor_quote_account.amount,
            args.max_quote_in,
            RelaunchError::InsufficientFunds
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: DepositViaBuyArgs) -> Result<()> {
        let relaunch_key = ctx.accounts.relaunch.key();

        let seeds = &[
            b"relaunch_signer",
            relaunch_key.as_ref(),
            &[ctx.accounts.relaunch.relaunch_signer_bump],
        ];
        let signer = &[&seeds[..]];

        let old_before = ctx.accounts.old_token_vault.amount;
        let quote_vault_before = ctx.accounts.source_quote_vault.amount;

        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.quote_token_program.to_account_info(),
                token::TransferChecked {
                    from: ctx.accounts.depositor_quote_account.to_account_info(),
                    mint: ctx.accounts.source_quote_mint.to_account_info(),
                    to: ctx.accounts.source_quote_vault.to_account_info(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            args.max_quote_in,
            ctx.accounts.source_quote_mint.decimals,
        )?;

        if ctx.accounts.user_volume_accumulator.data_is_empty() {
            pump_amm::init_user_volume_accumulator(pump_amm::InitUserVolumeAccumulator {
                payer: ctx.accounts.payer.to_account_info(),
                user: ctx.accounts.relaunch_signer.to_account_info(),
                user_volume_accumulator: ctx.accounts.user_volume_accumulator.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                event_authority: ctx.accounts.pump_event_authority.to_account_info(),
                program: ctx.accounts.pump_amm_program.to_account_info(),
            })?;
        }

        pump_amm::buy(
            pump_amm::Buy {
                pool: ctx.accounts.source_pool.to_account_info(),
                user: ctx.accounts.relaunch_signer.to_account_info(),
                global_config: ctx.accounts.pump_global_config.to_account_info(),
                base_mint: ctx.accounts.old_mint.to_account_info(),
                quote_mint: ctx.accounts.source_quote_mint.to_account_info(),
                user_base_token_account: ctx.accounts.old_token_vault.to_account_info(),
                user_quote_token_account: ctx.accounts.source_quote_vault.to_account_info(),
                pool_base_token_account: ctx.accounts.pool_base_token_account.to_account_info(),
                pool_quote_token_account: ctx.accounts.pool_quote_token_account.to_account_info(),
                protocol_fee_recipient: ctx.accounts.protocol_fee_recipient.to_account_info(),
                protocol_fee_recipient_token_account: ctx
                    .accounts
                    .protocol_fee_recipient_token_account
                    .to_account_info(),
                base_token_program: ctx.accounts.base_token_program.to_account_info(),
                quote_token_program: ctx.accounts.quote_token_program.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
                event_authority: ctx.accounts.pump_event_authority.to_account_info(),
                program: ctx.accounts.pump_amm_program.to_account_info(),
                coin_creator_vault_ata: ctx.accounts.coin_creator_vault_ata.to_account_info(),
                coin_creator_vault_authority: ctx
                    .accounts
                    .coin_creator_vault_authority
                    .to_account_info(),
                global_volume_accumulator: ctx.accounts.global_volume_accumulator.to_account_info(),
                user_volume_accumulator: ctx.accounts.user_volume_accumulator.to_account_info(),
                fee_config: ctx.accounts.pump_fee_config.to_account_info(),
                fee_program: ctx.accounts.pump_fee_program.to_account_info(),
                pool_v2: ctx.accounts.pool_v2.to_account_info(),
                buyback_fee_recipient: ctx.accounts.buyback_fee_recipient.to_account_info(),
                buyback_fee_recipient_token_account: ctx
                    .accounts
                    .buyback_fee_recipient_token_account
                    .to_account_info(),
            },
            args.base_out,
            args.max_quote_in,
            // Volume accumulators feed pump's user-incentive rewards, which
            // the relaunch_signer PDA could never claim — don't track.
            false,
            signer,
        )?;

        ctx.accounts.old_token_vault.reload()?;
        ctx.accounts.source_quote_vault.reload()?;

        let tokens_bought = ctx.accounts.old_token_vault.amount - old_before;
        let quote_refund = ctx.accounts.source_quote_vault.amount - quote_vault_before;
        let quote_spent = args.max_quote_in - quote_refund;

        if quote_refund > 0 {
            token::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.quote_token_program.to_account_info(),
                    token::TransferChecked {
                        from: ctx.accounts.source_quote_vault.to_account_info(),
                        mint: ctx.accounts.source_quote_mint.to_account_info(),
                        to: ctx.accounts.depositor_quote_account.to_account_info(),
                        authority: ctx.accounts.relaunch_signer.to_account_info(),
                    },
                    signer,
                ),
                quote_refund,
                ctx.accounts.source_quote_mint.decimals,
            )?;
        }

        ctx.accounts.deposit_record.credit(
            relaunch_key,
            ctx.accounts.depositor.key(),
            tokens_bought,
            ctx.bumps.deposit_record,
        );

        let relaunch = &mut ctx.accounts.relaunch;
        relaunch.total_deposited += tokens_bought;
        relaunch.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(TokensDepositedViaBuyEvent {
            common: CommonFields::new(&clock, ctx.accounts.relaunch.seq_num),
            relaunch: relaunch_key,
            depositor: ctx.accounts.depositor.key(),
            deposit_record: ctx.accounts.deposit_record.key(),
            amount: tokens_bought,
            quote_spent,
            total_deposited: ctx.accounts.relaunch.total_deposited,
            total_deposited_by_depositor: ctx.accounts.deposit_record.amount_deposited,
            deposit_record_seq_num: ctx.accounts.deposit_record.seq_num,
        });

        Ok(())
    }
}
