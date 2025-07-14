use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

use crate::{
    state::{FutarchyAmm, Side}, AutocratError
};

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct ArbitrarySwapParams {
    pub input: AssetAndAmount,
    pub outputs: Vec<AssetAndAmount>,
    pub quote_split_or_merge: SplitOrMergeAndAmount,
    pub base_split_or_merge: SplitOrMergeAndAmount,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct SpotSwapParams {
    pub side: Side,
    pub amount_in: u64,
    pub min_amount_out: u64,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct SplitOrMergeAndAmount {
    pub split_or_merge: SplitOrMerge,
    pub amount: u64,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub enum SplitOrMerge {
    Split,
    Merge,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct AssetAndAmount {
    pub asset: Asset,
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace, Debug, PartialEq, Eq)]
pub enum Asset {
    SpotQuote,
    SpotBase,
    PassQuote,
    PassBase,
    FailQuote,
    FailBase,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace, Debug, PartialEq, Eq)]
pub enum AssetType {
    Quote,
    Base,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace, Debug, PartialEq, Eq)]
pub enum Condition {
    Unconditional,
    Pass,
    Fail,
}

#[derive(Accounts)]
pub struct AmmTokenAccounts<'info> {
    #[account(mut)]
    pub base_unconditional: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub quote_unconditional: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub base_pass: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub quote_pass: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub base_fail: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub quote_fail: Box<Account<'info, TokenAccount>>,
}

#[derive(Accounts)]
#[event_cpi]
pub struct ArbitrarySwap<'info> {
    #[account(mut)]
    pub futarchy_amm: Account<'info, FutarchyAmm>,
    pub trader: Signer<'info>,
    #[account(mut)]
    pub trader_input_account: Account<'info, TokenAccount>,
    pub amm_token_accounts: AmmTokenAccounts<'info>,
    pub question: Box<Account<'info, conditional_vault::state::Question>>,
    pub base_mint: Box<Account<'info, token::Mint>>,
    pub quote_mint: Box<Account<'info, token::Mint>>,
    #[account(mut)]
    pub quote_vault: Box<Account<'info, conditional_vault::state::ConditionalVault>>,
    #[account(mut)]
    pub quote_vault_underlying_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub base_vault: Box<Account<'info, conditional_vault::state::ConditionalVault>>,
    #[account(mut)]
    pub base_vault_underlying_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub conditional_vault_program: Program<'info, conditional_vault::program::ConditionalVault>,
    /// CHECK: verified by conditional_vault
    pub vault_event_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub pass_quote_mint: Box<Account<'info, token::Mint>>,
    #[account(mut)]
    pub fail_quote_mint: Box<Account<'info, token::Mint>>,
    #[account(mut)]
    pub pass_base_mint: Box<Account<'info, token::Mint>>,
    #[account(mut)]
    pub fail_base_mint: Box<Account<'info, token::Mint>>,
}

#[derive(Accounts)]
#[event_cpi]
pub struct SpotSwap<'info> {
    pub arbitrary_swap: ArbitrarySwap<'info>,
}

pub fn min_b(a: f64, c: f64, d: f64, k1: f64, k2: f64) -> Option<f64> {
    if a + c <= 0.0 || k1 <= 0.0 || k2 <= 0.0 {
        return None;           // the neat closed form no longer applies
    }
    let sum = k1.sqrt() + k2.sqrt();
    Some(sum * sum / (a + c) - d)
}

pub fn witness(
    a: f64, b: f64, c: f64, d: f64, k1: f64, k2: f64, eps: f64
) -> Option<(f64, f64)> {
    let r = (k1 / k2).sqrt();
    let x = (a - r * c) / (1.0 + r);
    if !( -c < x && x < a ) { return None; }

    let y_lo =  k2 / (c + x) - d;
    let y_hi =  b + eps - k1 / (a - x);
    if y_lo > y_hi { return None; }

    Some((x, 0.5 * (y_lo + y_hi)))   // any y in [y_lo, y_hi] works
}

impl<'info, 'c: 'info> SpotSwap<'info> {
    pub fn handle(ctx: Context<'_, '_, 'info, 'info, Self>, params: SpotSwapParams) -> Result<()> {
        let SpotSwapParams { side, amount_in, min_amount_out } = params;

        let remaining_accs = &mut ctx.remaining_accounts.iter();

        let trader_output_account = next_account_info(remaining_accs)?;

        let (unconditional_quote, unconditional_base, pass_quote, pass_base, fail_quote, fail_base) = (
            ctx.accounts.arbitrary_swap.futarchy_amm.spot_pool.quote_reserves as f64,
            ctx.accounts.arbitrary_swap.futarchy_amm.spot_pool.base_reserves as f64,
            ctx.accounts.arbitrary_swap.futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.quote_reserves as f64,
            ctx.accounts.arbitrary_swap.futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.base_reserves as f64,
            ctx.accounts.arbitrary_swap.futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.quote_reserves as f64,
            ctx.accounts.arbitrary_swap.futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.base_reserves as f64,
        );

        let (a, b, c, d, e, f) = match side {
            Side::Buy => (unconditional_quote, unconditional_base, pass_quote, pass_base, fail_quote, fail_base),
            Side::Sell => (unconditional_base, unconditional_quote, fail_base, fail_quote, pass_base, pass_quote),
        };

        msg!("a: {}, b: {}, c: {}, d: {}, e: {}, f: {}", a, b, c, d, e, f);

        let b1 = min_b(a + amount_in as f64, c, d, a * b, c * d).unwrap();
        let b2 = min_b(a + amount_in as f64, e, f, a * b, e * f).unwrap();


        msg!("b1: {}", b1);
        msg!("b2: {}", b2);

        let (new_b, x, y) = if b1 > b2 { 
            let (x, y) = witness(a + amount_in as f64, b1, c, d, a * b, c * d, 1e-6).unwrap();
            (b1, x, y)
        } else { 
            let (x, y) = witness(a + amount_in as f64, b2, e, f, a * b, e * f, 1e-6).unwrap();
            (b2, x, y)
        };

        msg!("b: {}, x: {}, y: {}", new_b, x, y);


        let (input_asset, output_asset, quote_split, base_split) = if side == Side::Buy {
            (Asset::SpotQuote, Asset::SpotBase, x, y)
        } else {
            (Asset::SpotBase, Asset::SpotQuote, y, x)
        };


        // Create the parameters for ArbitrarySwap
        let arbitrary_params = ArbitrarySwapParams {
            input: AssetAndAmount { 
                asset: input_asset, 
                amount: amount_in 
            },
            outputs: vec![
                AssetAndAmount { 
                    asset: output_asset,
                    amount: (b - new_b) as u64 - 1,
                }
            ],
            quote_split_or_merge: SplitOrMergeAndAmount { 
                split_or_merge: if quote_split > 0.0 { SplitOrMerge::Split } else { SplitOrMerge::Merge }, 
                amount: quote_split.abs() as u64
            },
            base_split_or_merge: SplitOrMergeAndAmount { 
                split_or_merge: if base_split > 0.0 { SplitOrMerge::Split } else { SplitOrMerge::Merge }, 
                amount: base_split.abs() as u64
            },
        };

        ArbitrarySwap::handle(
            Context::<'_, '_, 'info, 'info, ArbitrarySwap>::new(
                ctx.program_id,
                &mut ctx.accounts.arbitrary_swap,
                ctx.remaining_accounts,
                ArbitrarySwapBumps {
                    amm_token_accounts: AmmTokenAccountsBumps {},
                    event_authority: ctx.bumps.event_authority,
                },
            ),
            arbitrary_params,
        )?;

        Ok(())
    }
}



impl<'info, 'c: 'info> ArbitrarySwap<'info> {
    pub fn validate(&self) -> Result<()> {
        let futarchy_amm = &self.futarchy_amm;

        require!(
            futarchy_amm.live_proposal.is_some(),
            AutocratError::ProposalNotLive
        );

        Ok(())
    }

    fn get_amm_token_account(
        amm_token_accounts: &AmmTokenAccounts<'info>,
        asset: Asset,
    ) -> AccountInfo<'info> {
        match asset {
            Asset::SpotQuote => amm_token_accounts.quote_unconditional.to_account_info(),
            Asset::SpotBase => amm_token_accounts.base_unconditional.to_account_info(),
            Asset::PassQuote => amm_token_accounts.quote_pass.to_account_info(),
            Asset::PassBase => amm_token_accounts.base_pass.to_account_info(),
            Asset::FailQuote => amm_token_accounts.quote_fail.to_account_info(),
            Asset::FailBase => amm_token_accounts.base_fail.to_account_info(),
        }
    }

    pub fn handle(
        ctx: Context<'_, '_, 'c, 'info, Self>,
        params: ArbitrarySwapParams,
    ) -> Result<()> {
        // First, pull the invariants
        let unconditional_k = ctx.accounts.amm_token_accounts.base_unconditional.amount as u128
            * ctx.accounts.amm_token_accounts.quote_unconditional.amount as u128;
        let pass_k = ctx.accounts.amm_token_accounts.base_pass.amount as u128
            * ctx.accounts.amm_token_accounts.quote_pass.amount as u128;
        let fail_k = ctx.accounts.amm_token_accounts.base_fail.amount as u128
            * ctx.accounts.amm_token_accounts.quote_fail.amount as u128;

        // Second, optimistically assume that the swap will succeed and do all the transfers and splits/merges

        msg!("params: {:?}", params);

        let signer_seeds = &[b"futarchy_amm".as_ref(), &[ctx.accounts.futarchy_amm.bump]];
        let signer = &[&signer_seeds[..]];


        let amm_input_account = Self::get_amm_token_account(
            &ctx.accounts.amm_token_accounts,
            params.input.asset,
        );

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.trader_input_account.to_account_info(),
                    to: amm_input_account,
                    authority: ctx.accounts.trader.to_account_info(),
                },
            ),
            params.input.amount,
        )?;

        let remaining_accs = &mut ctx.remaining_accounts.iter();

        for output in params.outputs {
            let trader_output_account = next_account_info(remaining_accs)?;
            let amm_output_account = Self::get_amm_token_account(
                &ctx.accounts.amm_token_accounts,
                output.asset,
            );

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token::Transfer {
                        from: amm_output_account,
                        to: trader_output_account.to_account_info(),
                        authority: ctx.accounts.futarchy_amm.to_account_info(),
                    },
                    signer,
                ),
                output.amount,
            )?;
        }

        let quote_split_or_merge = params.quote_split_or_merge;

        let quote_cpi_context = CpiContext::new_with_signer(
            ctx.accounts.conditional_vault_program.to_account_info(),
            conditional_vault::cpi::accounts::InteractWithVault {
                question: ctx.accounts.question.to_account_info(),
                vault: ctx.accounts.quote_vault.to_account_info(),
                vault_underlying_token_account: ctx
                    .accounts
                    .quote_vault_underlying_token_account
                    .to_account_info(),
                authority: ctx.accounts.futarchy_amm.to_account_info(),
                user_underlying_token_account: ctx
                    .accounts
                    .amm_token_accounts
                    .quote_unconditional
                    .to_account_info(),
                event_authority: ctx.accounts.vault_event_authority.to_account_info(),
                program: ctx.accounts.conditional_vault_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            signer,
        )
        .with_remaining_accounts(vec![
            ctx.accounts.fail_quote_mint.to_account_info(),
            ctx.accounts.pass_quote_mint.to_account_info(),
            ctx.accounts.amm_token_accounts.quote_fail.to_account_info(),
            ctx.accounts.amm_token_accounts.quote_pass.to_account_info(),
        ]);

        if quote_split_or_merge.split_or_merge == SplitOrMerge::Split {
            conditional_vault::cpi::split_tokens(quote_cpi_context, quote_split_or_merge.amount)?;
        } else {
            conditional_vault::cpi::merge_tokens(quote_cpi_context, quote_split_or_merge.amount)?;
        }

        let base_split_or_merge = params.base_split_or_merge;

        let base_cpi_context = CpiContext::new_with_signer(
            ctx.accounts.conditional_vault_program.to_account_info(),
            conditional_vault::cpi::accounts::InteractWithVault {
                question: ctx.accounts.question.to_account_info(),
                vault: ctx.accounts.base_vault.to_account_info(),
                vault_underlying_token_account: ctx
                    .accounts
                    .base_vault_underlying_token_account
                    .to_account_info(),
                authority: ctx.accounts.futarchy_amm.to_account_info(),
                user_underlying_token_account: ctx
                    .accounts
                    .amm_token_accounts
                    .base_unconditional
                    .to_account_info(),
                event_authority: ctx.accounts.vault_event_authority.to_account_info(),
                program: ctx.accounts.conditional_vault_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            signer,
        )
        .with_remaining_accounts(vec![
            ctx.accounts.fail_base_mint.to_account_info(),
            ctx.accounts.pass_base_mint.to_account_info(),
            ctx.accounts.amm_token_accounts.base_fail.to_account_info(),
            ctx.accounts.amm_token_accounts.base_pass.to_account_info(),
        ]);

        if base_split_or_merge.split_or_merge == SplitOrMerge::Split {
            conditional_vault::cpi::split_tokens(base_cpi_context, base_split_or_merge.amount)?;
        } else {
            conditional_vault::cpi::merge_tokens(base_cpi_context, base_split_or_merge.amount)?;
        }

        // Third, check the invariants again

        ctx.accounts.amm_token_accounts.quote_unconditional.reload()?;
        ctx.accounts.amm_token_accounts.base_unconditional.reload()?;

        ctx.accounts.amm_token_accounts.quote_pass.reload()?;
        ctx.accounts.amm_token_accounts.base_pass.reload()?;

        ctx.accounts.amm_token_accounts.quote_fail.reload()?;
        ctx.accounts.amm_token_accounts.base_fail.reload()?;

        let unconditional_k_after = ctx.accounts.amm_token_accounts.base_unconditional.amount as u128
            * ctx.accounts.amm_token_accounts.quote_unconditional.amount as u128;
        let pass_k_after = ctx.accounts.amm_token_accounts.base_pass.amount as u128
            * ctx.accounts.amm_token_accounts.quote_pass.amount as u128;
        let fail_k_after = ctx.accounts.amm_token_accounts.base_fail.amount as u128
            * ctx.accounts.amm_token_accounts.quote_fail.amount as u128;

        require_gte!(unconditional_k_after, unconditional_k, AutocratError::InvariantViolation);
        require_gte!(pass_k_after, pass_k, AutocratError::InvariantViolation);
        require_gte!(fail_k_after, fail_k, AutocratError::InvariantViolation);

        let futarchy_amm = &mut ctx.accounts.futarchy_amm;
        futarchy_amm.spot_pool.quote_reserves = ctx.accounts.amm_token_accounts.quote_unconditional.amount;
        futarchy_amm.spot_pool.base_reserves = ctx.accounts.amm_token_accounts.base_unconditional.amount;
        futarchy_amm.live_proposal.as_mut().unwrap().pass_pool.quote_reserves = ctx.accounts.amm_token_accounts.quote_pass.amount;
        futarchy_amm.live_proposal.as_mut().unwrap().pass_pool.base_reserves = ctx.accounts.amm_token_accounts.base_pass.amount;
        futarchy_amm.live_proposal.as_mut().unwrap().fail_pool.quote_reserves = ctx.accounts.amm_token_accounts.quote_fail.amount;
        futarchy_amm.live_proposal.as_mut().unwrap().fail_pool.base_reserves = ctx.accounts.amm_token_accounts.base_fail.amount;


        Ok(())
    }
}
