use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
// Assuming 6 decimal places, this means we can handle up to 2**52 * 2**52, so 4B tokens * 4B tokens
use fixed::types::I104F24;

use crate::{
    state::{Amm, Side}, AutocratError
};

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct TradeExecutionParams {
    pub input: AssetAndAmount,
    pub output: AssetAndAmount,
    pub quote_split_or_merge: SplitOrMergeAndAmount,
    pub base_split_or_merge: SplitOrMergeAndAmount,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct SpotTradeParams {
    pub side: Side,
    pub amount_in: u64,
    pub min_amount_out: u64,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct CondSwapParams {
    pub side: Side,
    pub underlying_asset: UnderlyingAsset,
    pub amount_in: u64,
    pub min_amount_out: u64,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub enum UnderlyingAsset {
    Base,
    Quote,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct PredictionSwapParams {
    pub side: Side,
    pub underlying_asset: UnderlyingAsset,
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
    #[account(mut, associated_token::mint = base_vault.underlying_token_mint, associated_token::authority = futarchy_amm)]
    pub unconditional_base: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = quote_vault.underlying_token_mint, associated_token::authority = futarchy_amm)]
    pub unconditional_quote: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = base_vault.conditional_token_mints[1], associated_token::authority = futarchy_amm)]
    pub pass_base: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = quote_vault.conditional_token_mints[1], associated_token::authority = futarchy_amm)]
    pub pass_quote: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = base_vault.conditional_token_mints[0], associated_token::authority = futarchy_amm)]
    pub fail_base: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = quote_vault.conditional_token_mints[0], associated_token::authority = futarchy_amm)]
    pub fail_quote: Box<Account<'info, TokenAccount>>,
    pub base_vault: Box<Account<'info, conditional_vault::state::ConditionalVault>>,
    pub quote_vault: Box<Account<'info, conditional_vault::state::ConditionalVault>>,
    pub futarchy_amm: Account<'info, Amm>,
}

#[derive(Accounts)]
#[event_cpi]
pub struct Trade<'info> {
    #[account(mut)]
    pub futarchy_amm: Account<'info, Amm>,
    pub trader: Signer<'info>,
    #[account(mut)]
    pub trader_input_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub trader_output_account: Box<Account<'info, TokenAccount>>,
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

pub fn min_b_three_fixed(
    a: I104F24,
    c: I104F24,
    d: I104F24,
    e: I104F24,
    f_: I104F24,
    k1: I104F24,
    k2: I104F24,
    k3: I104F24,
) -> Option<(I104F24, I104F24, I104F24)> {
    if !(k1 > 0.0 && k2 > 0.0 && k3 > 0.0) {
        return None;
    }

    let y2 = |x: I104F24| k2 / (c + x) - d;
    let y3 = |x: I104F24| k3 / (e + x) - f_;

    let mut b12 = I104F24::MAX; let mut x12 = I104F24::MAX; let mut y12 = I104F24::MAX;
    let mut b13 = I104F24::MAX; let mut x13 = I104F24::MAX; let mut y13 = I104F24::MAX;
    let mut b_eq = I104F24::MAX; let mut x_eq = I104F24::MAX; let mut y_eq = I104F24::MAX;

    // --- Case 1: constraints (1)&(2) both tight ---
    // (1): (a - x)(b - y) = k1  =>  b = k1/(a-x) + y  => b(x) = k1/(a-x) + y2(x)
    // (2) tight gives y = y2(x)
    // To minimize b(x), set its derivative to zero => tangency condition:
    //   d/dx [k1/(a-x) + y2(x)] = 0  <=>  sqrt(k1)/(a-x) = sqrt(k2)/(c+x)
    {   // Tangency sqrt(k1)/(a-x) = sqrt(k2)/(c+x)
        // Solve sqrt(k1)/(a-x) = sqrt(k2)/(c+x) for x:
        //   sqrt(k1)*(c+x) = sqrt(k2)*(a-x)
        //   => sqrt(k1)*c + sqrt(k1)*x = sqrt(k2)*a - sqrt(k2)*x
        //   => x*(sqrt(k1)+sqrt(k2)) = sqrt(k2)*a - sqrt(k1)*c
        //   => x = [sqrt(k2)*a - sqrt(k1)*c] / [sqrt(k1)+sqrt(k2)]
        let x = ((a.checked_mul(k2.sqrt())).unwrap() - (c * k1.sqrt())) / (k1.sqrt() + k2.sqrt());
        // msg!("x: {}, k2.sqrt(): {}, k1.sqrt(): {}, (a * k2.sqrt()) = {}, (c * k1.sqrt()) = {}", x, k2.sqrt(), k1.sqrt(), a * k2.sqrt(), c * k1.sqrt());
        // msg!("x: {}, k2.sqrt(): {}, k1.sqrt(): {}, (a * k2.sqrt()) = {}, (c * k1.sqrt()) = {}, (a * k2.sqrt()) - (c * k1.sqrt()) = {}, a = {a}, c = {c}", x, k2.sqrt(), k1.sqrt(), a * k2.sqrt(), c * k1.sqrt(), (a * k2.sqrt()) - (c * k1.sqrt()));
        // Equivalent but simplified: x = (a - s*c)/(1 + s)
        // Check domain: a - x > 0 and c + x > 0
        if x > -c && x < a {
            let y = y2(x);  // from constraint 2
            // Must also satisfy constraint 3 slack: y >= y3(x)
            if y >= y3(x) {
                let b = k1 / (a - x) + y;  // compute b(x)
                b12 = b; x12 = x; y12 = y;
            }
        }
    }

    // --- Case 2: constraints (1)&(3) both tight ---
    // Analogous to Case 1 but use y3(x)
    // b(x) = k1/(a-x) + y3(x)
    // Tangency: sqrt(k1)/(a-x) = sqrt(k3)/(e+x)
    {   // solve x = [sqrt(k3)*a - sqrt(k1)*e] / [sqrt(k1)+sqrt(k3)]
        let x = (a * (k3.sqrt()) - e * (k1.sqrt())) / (k1.sqrt() + k3.sqrt());
        if x > -e && x < a {
            let y = y3(x);
            // ensure constraint 2 slack: y >= y2(x)
            if y >= y2(x) {
                let b = k1 / (a - x) + y;
                b13 = b; x13 = x; y13 = y;
            }
        }
    }

    // --- Case 3: constraints (2)&(3) tangent ---
    // y2(x) = y3(x) => k2/(c+x) - d = k3/(e+x) - f_
    // Multiply both sides by (c+x)(e+x): k2(e+x) - d(c+x)(e+x) = k3(c+x) - f_(c+x)(e+x)
    // Rearranged gives quadratic A x^2 + B x + C = 0:
    //   A = d - f_
    //   B = k2 - k3 - A*(c+e)
    //   C = k2*e - k3*c - A*c*e
    {
        let A = d - f_;
        let B = k2 - k3 - A * (c + e);
        let C = k2 * e - k3 * c - A * c * e;
        let mut check_root = |x: I104F24| {
            if x > -c && x > -e && x < a {
                let y = y2(x);                    // common y
                // b(x) = k1/(a-x) + y
                let b = k1 / (a - x) + y;
                // ensure constraint 1 slack: (a-x)(b-y)>=k1 => y <= b - k1/(a-x)
                if y <= b - k1 / (a - x) {
                    b_eq = b; x_eq = x; y_eq = y;
                }
            }
        };
        if A.abs() < 1e-12 {
            if B.abs() > 1e-12 { check_root(-C / B); }
        } else {
            let disc = B * B - I104F24::from_num(4.0) * A * C;
            if disc >= 0.0 {
                let rt = disc.sqrt();
                check_root((-B - rt) / (I104F24::from_num(2.0) * A));
                check_root((-B + rt) / (I104F24::from_num(2.0) * A));
            }
        }
    }
    msg!("b12: {}, b13: {}, b_eq: {}", b12, b13, b_eq);

    // --- Final: choose the smallest b among three cases ---
    let (b_min, x_star, y_star) = if b12 <= b13 && b12 <= b_eq {
        (b12, x12, y12)
    } else if b13 <= b12 && b13 <= b_eq {
        (b13, x13, y13)
    } else {
        (b_eq, x_eq, y_eq)
    };

    // If no finite candidate, infeasible
    if b_min == I104F24::MAX {
        None
    } else {
        Some((b_min, x_star, y_star))
    }
}

pub fn min_b_three(
    a: f64,
    c: f64,
    d: f64,
    e: f64,
    f_: f64,
    k1: f64,
    k2: f64,
    k3: f64,
) -> Option<(f64, f64, f64)> {
    // 1) Sanity checks
    //    - All k1,k2,k3 must be positive for hyperbolas to make sense
    if !(k1 > 0.0 && k2 > 0.0 && k3 > 0.0) {
        return None;
    }

    // Define helper closures for y bounds:
    // Constraint (2): (c + x)(d + y) = k2  =>  d + y = k2/(c+x)  =>  y2(x) = k2/(c+x) - d
    let y2 = |x: f64| k2 / (c + x) - d;
    // Constraint (3): (e + x)(f + y) = k3  =>  f + y = k3/(e+x)  =>  y3(x) = k3/(e+x) - f_
    let y3 = |x: f64| k3 / (e + x) - f_;

    // Prepare storage for three candidate solutions
    let mut b12 = f64::INFINITY; let mut x12 = f64::NAN; let mut y12 = f64::NAN;
    let mut b13 = f64::INFINITY; let mut x13 = f64::NAN; let mut y13 = f64::NAN;
    let mut b_eq = f64::INFINITY; let mut x_eq = f64::NAN; let mut y_eq = f64::NAN;

    // --- Case 1: constraints (1)&(2) both tight ---
    // (1): (a - x)(b - y) = k1  =>  b = k1/(a-x) + y  => b(x) = k1/(a-x) + y2(x)
    // (2) tight gives y = y2(x)
    // To minimize b(x), set its derivative to zero => tangency condition:
    //   d/dx [k1/(a-x) + y2(x)] = 0  <=>  sqrt(k1)/(a-x) = sqrt(k2)/(c+x)
    {   // Tangency sqrt(k1)/(a-x) = sqrt(k2)/(c+x)
        // let s = (k2 / k1).sqrt();
        // Solve sqrt(k1)/(a-x) = sqrt(k2)/(c+x) for x:
        //   sqrt(k1)*(c+x) = sqrt(k2)*(a-x)
        //   => sqrt(k1)*c + sqrt(k1)*x = sqrt(k2)*a - sqrt(k2)*x
        //   => x*(sqrt(k1)+sqrt(k2)) = sqrt(k2)*a - sqrt(k1)*c
        //   => x = [sqrt(k2)*a - sqrt(k1)*c] / [sqrt(k1)+sqrt(k2)]
        let x = (a * (k2.sqrt()) - c * (k1.sqrt())) / (k1.sqrt() + k2.sqrt());
        // msg!("x: {}, k2.sqrt(): {}, k1.sqrt(): {}", x, k2.sqrt(), k1.sqrt());
        // msg!("x: {}, k2.sqrt(): {}, k1.sqrt(): {}, (a * k2.sqrt()) = {}, (c * k1.sqrt()) = {}, (a * k2.sqrt()) - (c * k1.sqrt()) = {}", x, k2.sqrt(), k1.sqrt(), a * k2.sqrt(), c * k1.sqrt(), a * k2.sqrt() - c * k1.sqrt());
        // msg!("x: {}, k2.sqrt(): {}, k1.sqrt(): {}, (a * k2.sqrt()) = {}, (c * k1.sqrt()) = {}, (a * k2.sqrt()) - (c * k1.sqrt()) = {}, a = {a}, c = {c}", x, k2.sqrt(), k1.sqrt(), a * k2.sqrt(), c * k1.sqrt(), (a * k2.sqrt()) - (c * k1.sqrt()));
        // Equivalent but simplified: x = (a - s*c)/(1 + s)
        // Check domain: a - x > 0 and c + x > 0
        if x > -c && x < a {
            let y = y2(x);  // from constraint 2
            // Must also satisfy constraint 3 slack: y >= y3(x)
            if y >= y3(x) {
                let b = k1 / (a - x) + y;  // compute b(x)
                b12 = b; x12 = x; y12 = y;
            }
        }
    }

    // --- Case 2: constraints (1)&(3) both tight ---
    // Analogous to Case 1 but use y3(x)
    // b(x) = k1/(a-x) + y3(x)
    // Tangency: sqrt(k1)/(a-x) = sqrt(k3)/(e+x)
    {   // solve x = [sqrt(k3)*a - sqrt(k1)*e] / [sqrt(k1)+sqrt(k3)]
        let x = (a * (k3.sqrt()) - e * (k1.sqrt())) / (k1.sqrt() + k3.sqrt());
        if x > -e && x < a {
            let y = y3(x);
            // ensure constraint 2 slack: y >= y2(x)
            if y >= y2(x) {
                let b = k1 / (a - x) + y;
                b13 = b; x13 = x; y13 = y;
            }
        }
    }

    // --- Case 3: constraints (2)&(3) tangent ---
    // y2(x) = y3(x) => k2/(c+x) - d = k3/(e+x) - f_
    // Multiply both sides by (c+x)(e+x): k2(e+x) - d(c+x)(e+x) = k3(c+x) - f_(c+x)(e+x)
    // Rearranged gives quadratic A x^2 + B x + C = 0:
    //   A = d - f_
    //   B = k2 - k3 - A*(c+e)
    //   C = k2*e - k3*c - A*c*e
    {
        let A = d - f_;
        let B = k2 - k3 - A * (c + e);
        let C = k2 * e - k3 * c - A * c * e;
        let mut check_root = |x: f64| {
            if x > -c && x > -e && x < a {
                let y = y2(x);                    // common y
                // b(x) = k1/(a-x) + y
                let b = k1 / (a - x) + y;
                // ensure constraint 1 slack: (a-x)(b-y)>=k1 => y <= b - k1/(a-x)
                if y <= b - k1 / (a - x) {
                    b_eq = b; x_eq = x; y_eq = y;
                }
            }
        };
        if A.abs() < 1e-12 {
            if B.abs() > 1e-12 { check_root(-C / B); }
        } else {
            let disc = B * B - 4.0 * A * C;
            if disc >= 0.0 {
                let rt = disc.sqrt();
                check_root((-B - rt) / (2.0 * A));
                check_root((-B + rt) / (2.0 * A));
            }
        }
    }

    msg!("b12: {}, b13: {}, b_eq: {}", b12, b13, b_eq);

    // --- Final: choose the smallest b among three cases ---
    let (b_min, x_star, y_star) = if b12 <= b13 && b12 <= b_eq {
        (b12, x12, y12)
    } else if b13 <= b12 && b13 <= b_eq {
        (b13, x13, y13)
    } else {
        (b_eq, x_eq, y_eq)
    };

    // If no finite candidate, infeasible
    if !b_min.is_finite() {
        None
    } else {
        Some((b_min, x_star, y_star))
    }
}

pub fn min_d_three(
    a: f64,
    b: f64,
    c: f64,
    e: f64,
    f_: f64,
    k1: f64,
    k2: f64,
    k3: f64,
) -> Option<(f64, f64, f64)> {
    // 1) Sanity: all k1,k2,k3 > 0
    if !(k1 > 0.0 && k2 > 0.0 && k3 > 0.0) {
        return None;
    }
    // Helper closures:
    // Constraint1 → y = b - k1/(a-x)
    let y1 = |x: f64| b - k1 / (a - x);
    // Constraint3 → y = k3/(e+x) - f_
    let y3 = |x: f64| k3 / (e + x) - f_;

    // Store candidates: d12,d23,d13
    let mut d12 = f64::INFINITY; let mut x12 = f64::NAN; let mut y12 = f64::NAN;
    let mut d23 = f64::INFINITY; let mut x23 = f64::NAN; let mut y23 = f64::NAN;
    let mut d13 = f64::INFINITY; let mut x13 = f64::NAN; let mut y13 = f64::NAN;

    // --- Case 1: (1)&(2) tight ---
    // y from (1): y=y1(x);
    // then solve (c+x)(d+y)=k2 → d(x)=k2/(c+x)-y1(x)
    // minimize via tangency of f1,f2 → sqrt(k1)/(a-x)=sqrt(k2)/(c+x)
    {
        // Solve for x: sqrt(k1)*(c+x)=sqrt(k2)*(a-x)
        let x = (a * k2.sqrt() - c * k1.sqrt()) / (k1.sqrt() + k2.sqrt());
        if x > -c && x < a {
            let y = y1(x);
            // ensure constraint3 slack: y >= y3(x)
            if y >= y3(x) {
                let d_val = k2 / (c + x) - y;
                d12 = d_val; x12 = x; y12 = y;
            }
        }
    }

    // --- Case 2: (2)&(3) tight ---
    // y from (3): y=y3(x);
    // (c+x)(d+y)=k2 → d(x)=k2/(c+x)-y3(x)
    // tangency f2,f3 → sqrt(k2)/(c+x)=sqrt(k3)/(e+x)
    {
        let x = (c * k3.sqrt() - e * k2.sqrt()) / (k2.sqrt() + k3.sqrt());
        if x > -e && x > -c {
            let y = y3(x);
            // ensure constraint1 slack: y <= b - k1/(a-x)
            if y <= y1(x) {
                let d_val = k2 / (c + x) - y;
                d23 = d_val; x23 = x; y23 = y;
            }
        }
    }

    // --- Case 3: (1)&(3) tight ---
    // Constraints tight:
    //   (1) (a - x)(b - y) = k1  ⇒  y = b - k1/(a-x)
    //   (3) (e + x)(f + y) = k3  ⇒  y = k3/(e+x) - f_
    // Set equal: b - k1/(a-x) = k3/(e+x) - f_
    // Multiply both sides by (a-x)(e+x):
    //   (b - f_)*(a-x)*(e+x) = (k3)*(a-x) + (k1)*(e+x)
    // Expand LHS: (b-f_)*(ae + a x - e x - x^2)
    // Bring RHS terms over to form quadratic in x:
    //   (b-f_)*(-x^2) + (b-f_)*(a - e)*x + (b-f_)*a e - k3*(a-x) - k1*(e+x) = 0
    // Combine like terms to Ax^2 + Bx + C = 0:
    let A = -(b - f_);
    let B = (b - f_)*(a - e) + k3 - k1;
    let C = (b - f_)*a*e - k3*a - k1*e;
    // Now solve A x^2 + B x + C = 0
    let mut test = |x: f64| {
        if x > -c && x > -e && x < a {
            let y = y1(x);
            let d_val = k2 / (c + x) - y;    // from constraint 2
            // ensure slack on 2: (c+x)(d+y)>=k2 ⇒ no extra check as computed x from tight 1&3
            d13 = d_val; x13 = x; y13 = y;
        }
    };
    if A.abs() < 1e-12 {
        if B.abs() > 1e-12 { test(-C / B); }
    } else {
        let disc = B * B - 4.0 * A * C;
        if disc >= 0.0 {
            let rt = disc.sqrt();
            test((-B - rt) / (2.0 * A));
            test((-B + rt) / (2.0 * A));
        }
    }

    // pick minimal d
    let (d_min, xs, ys) = if d12 <= d23 && d12 <= d13 {
        (d12, x12, y12)
    } else if d23 <= d12 && d23 <= d13 {
        (d23, x23, y23)
    } else {
        (d13, x13, y13)
    };
    if !d_min.is_finite() {
        None
    } else {
        Some((d_min, xs, ys))
    }
}

impl Trade<'_> {
    pub fn spot_trade(ctx: Context<Self>, params: SpotTradeParams) -> Result<()> {
        let SpotTradeParams { side, amount_in, min_amount_out } = params;

        let (unconditional_quote, unconditional_base, pass_quote, pass_base, fail_quote, fail_base) = (
            I104F24::from_num(ctx.accounts.amm_token_accounts.unconditional_quote.amount),
            I104F24::from_num(ctx.accounts.amm_token_accounts.unconditional_base.amount),
            I104F24::from_num(ctx.accounts.amm_token_accounts.pass_quote.amount),
            I104F24::from_num(ctx.accounts.amm_token_accounts.pass_base.amount),
            I104F24::from_num(ctx.accounts.amm_token_accounts.fail_quote.amount),
            I104F24::from_num(ctx.accounts.amm_token_accounts.fail_base.amount),
        );

        let (a, b, c, d, e, f) = match side {
            Side::Buy => (unconditional_quote, unconditional_base, pass_quote, pass_base, fail_quote, fail_base),
            Side::Sell => (unconditional_base, unconditional_quote, pass_base, pass_quote, fail_base, fail_quote),
        };

        let (new_b, x, y) = min_b_three_fixed(a + I104F24::from_num(amount_in), c, d, e, f, a * b, c * d, e * f).unwrap();

        let (input_asset, output_asset, quote_split, base_split) = if side == Side::Buy {
            (Asset::SpotQuote, Asset::SpotBase, x, y)
        } else {
            (Asset::SpotBase, Asset::SpotQuote, y, x)
        };

        // msg!("new_b: {}, x: {}, y: {}", new_b, x, y);


        // let (unconditional_quote, unconditional_base, pass_quote, pass_base, fail_quote, fail_base) = (
        //     ctx.accounts.amm_token_accounts.unconditional_quote.amount as f64,
        //     ctx.accounts.amm_token_accounts.unconditional_base.amount as f64,
        //     ctx.accounts.amm_token_accounts.pass_quote.amount as f64,
        //     ctx.accounts.amm_token_accounts.pass_base.amount as f64,
        //     ctx.accounts.amm_token_accounts.fail_quote.amount as f64,
        //     ctx.accounts.amm_token_accounts.fail_base.amount as f64,
        // );

        // let (a, b, c, d, e, f) = match side {
        //     Side::Buy => (unconditional_quote, unconditional_base, pass_quote, pass_base, fail_quote, fail_base),
        //     Side::Sell => (unconditional_base, unconditional_quote, pass_base, pass_quote, fail_base, fail_quote),
        // };

        // let (new_b, x, y) = min_b_three(a + amount_in as f64, c, d, e, f, a * b, c * d, e * f).unwrap();

        // msg!("new_b: {}, x: {}, y: {}", new_b, x, y);

        // let (input_asset, output_asset, quote_split, base_split) = if side == Side::Buy {
        //     (Asset::SpotQuote, Asset::SpotBase, x, y)
        // } else {
        //     (Asset::SpotBase, Asset::SpotQuote, y, x)
        // };

        let quote_split_or_marge = if quote_split > 0.0 {
            SplitOrMergeAndAmount {
                split_or_merge: SplitOrMerge::Split,
                amount: quote_split.abs().to_num::<u64>() + 1,
            }
        } else {
            SplitOrMergeAndAmount {
                split_or_merge: SplitOrMerge::Merge,
                amount: quote_split.abs().to_num::<u64>() - 1,
            }
        };

        // // Create the parameters for ArbitrarySwap
        let trade_execution_params = TradeExecutionParams {
            input: AssetAndAmount { 
                asset: input_asset, 
                amount: amount_in 
            },
            output: AssetAndAmount { 
                asset: output_asset,
                amount: (b - new_b).to_num::<u64>() - 1,
            },
            quote_split_or_merge: quote_split_or_marge,
            base_split_or_merge: SplitOrMergeAndAmount { 
                split_or_merge: if base_split > 0.0 { SplitOrMerge::Split } else { SplitOrMerge::Merge }, 
                amount: base_split.abs().to_num::<u64>()
            },
        };

        Self::execute_trade(ctx, trade_execution_params)?;

        Ok(())
    }

    pub fn conditional_trade(ctx: Context<Self>, params: CondSwapParams) -> Result<()> {
        let CondSwapParams { side, underlying_asset, amount_in, min_amount_out } = params;

        assert!(underlying_asset == UnderlyingAsset::Quote);
        assert!(side == Side::Buy);

        let remaining_accs = &mut ctx.remaining_accounts.iter();

        let trader_output_account = next_account_info(remaining_accs)?;

        // let (unconditional_quote, unconditional_base, pass_quote, pass_base, fail_quote, fail_base) = (
        //     ctx.accounts.arbitrary_swap.futarchy_amm.spot_pool.quote_reserves as f64,
        //     ctx.accounts.arbitrary_swap.futarchy_amm.spot_pool.base_reserves as f64,
        //     ctx.accounts.arbitrary_swap.futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.quote_reserves as f64,
        //     ctx.accounts.arbitrary_swap.futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.base_reserves as f64,
        //     ctx.accounts.arbitrary_swap.futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.quote_reserves as f64,
        //     ctx.accounts.arbitrary_swap.futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.base_reserves as f64,
        // );

        // let (b, a, d, c, f, e) = (unconditional_quote, unconditional_base, pass_quote, pass_base, fail_quote, fail_base);

        // let (min_c, x, y) = min_c_three(a, b, d + amount_in as f64, e, f, a*b, c*d, e*f).unwrap();

        // // let (x, y) = witness(a, b, c, d + amount_in as f64, a*b, c*d, 1e-6).unwrap();

        // msg!("current_c: {}", c);
        // msg!("min_c: {}", min_c);
        // msg!("amount_in: {}", amount_in);
        // msg!("delta: {}", c - min_c);
        // msg!("x: {}, y: {}", x, y);

        // // Create the parameters for ArbitrarySwap
        // let arbitrary_params = ArbitrarySwapParams {
        //     input: AssetAndAmount { 
        //         asset: Asset::PassQuote,
        //         amount: amount_in,
        //     },
        //     outputs: vec![
        //         AssetAndAmount { 
        //             asset: Asset::PassBase,
        //             amount: (c - min_c) as u64 - 1,
        //         }
        //     ],
        //     quote_split_or_merge: SplitOrMergeAndAmount { 
        //         split_or_merge: if y > 0.0 { SplitOrMerge::Split } else { SplitOrMerge::Merge }, 
        //         amount: y.abs() as u64
        //     },
        //     base_split_or_merge: SplitOrMergeAndAmount { 
        //         split_or_merge: if x > 0.0 { SplitOrMerge::Split } else { SplitOrMerge::Merge }, 
        //         amount: x.abs() as u64
        //     },
        // };

        // ArbitrarySwap::handle(
        //     Context::<'_, '_, 'info, 'info, ArbitrarySwap>::new(
        //         ctx.program_id,
        //         &mut ctx.accounts.arbitrary_swap,
        //         ctx.remaining_accounts,
        //         ArbitrarySwapBumps {
        //             amm_token_accounts: AmmTokenAccountsBumps {},
        //             event_authority: ctx.bumps.event_authority,
        //         },
        //     ),
        //     arbitrary_params,
        // )?;

        Ok(())
    }

    pub fn prediction_trade(ctx: Context<Self>, params: PredictionSwapParams) -> Result<()> {
        let PredictionSwapParams { side, underlying_asset, amount_in, min_amount_out } = params;

        assert!(underlying_asset == UnderlyingAsset::Quote);
        assert!(side == Side::Buy);

        let remaining_accs = &mut ctx.remaining_accounts.iter();

        let trader_output_account = next_account_info(remaining_accs)?;

        // let (unconditional_quote, unconditional_base, pass_quote, pass_base, fail_quote, fail_base) = (
        //     ctx.accounts.arbitrary_swap.futarchy_amm.spot_pool.quote_reserves as f64,
        //     ctx.accounts.arbitrary_swap.futarchy_amm.spot_pool.base_reserves as f64,
        //     ctx.accounts.arbitrary_swap.futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.quote_reserves as f64,
        //     ctx.accounts.arbitrary_swap.futarchy_amm.live_proposal.as_ref().unwrap().pass_pool.base_reserves as f64,
        //     ctx.accounts.arbitrary_swap.futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.quote_reserves as f64,
        //     ctx.accounts.arbitrary_swap.futarchy_amm.live_proposal.as_ref().unwrap().fail_pool.base_reserves as f64,
        // );

        // let (a, b, c, d, e, f) = (unconditional_base, unconditional_quote, pass_base, pass_quote, fail_base, fail_quote);

        // let (min_d, x, y) = min_d_three(a, b + amount_in as f64, c, e, f, a*b, c*d, e*f).unwrap();

        // let (pquote_out, quote_split_or_merge, base_split_or_merge) = (d - min_d, y, x);

        // msg!("pquote_out: {}", pquote_out);
        // msg!("quote_split_or_merge: {}", quote_split_or_merge);
        // msg!("base_split_or_merge: {}", base_split_or_merge);

        // // msg!("current_c: {}", c);
        // // msg!("min_c: {}", min_c);
        // // msg!("amount_in: {}", amount_in);
        // // msg!("delta: {}", c - min_c);

        // let quote_split_or_merge = if quote_split_or_merge > 0.0 {
        //     SplitOrMergeAndAmount {
        //         split_or_merge: SplitOrMerge::Split,
        //         amount: quote_split_or_merge.abs() as u64,
        //     }
        // } else {
        //     SplitOrMergeAndAmount {
        //         split_or_merge: SplitOrMerge::Merge,
        //         amount: quote_split_or_merge.abs() as u64,
        //     }
        // };


        // // Create the parameters for ArbitrarySwap
        // let arbitrary_params = ArbitrarySwapParams {
        //     input: AssetAndAmount { 
        //         asset: Asset::SpotQuote, 
        //         amount: amount_in
        //     },
        //     outputs: vec![
        //         AssetAndAmount { 
        //             asset: Asset::PassQuote,
        //             amount: pquote_out as u64,
        //         }
        //     ],
        //     quote_split_or_merge,
        //     base_split_or_merge: SplitOrMergeAndAmount { 
        //         split_or_merge: if base_split_or_merge > 0.0 { SplitOrMerge::Split } else { SplitOrMerge::Merge }, 
        //         amount: base_split_or_merge.abs() as u64
        //     },
        // };

        // ArbitrarySwap::handle(
        //     Context::<'_, '_, 'info, 'info, ArbitrarySwap>::new(
        //         ctx.program_id,
        //         &mut ctx.accounts.arbitrary_swap,
        //         ctx.remaining_accounts,
        //         ArbitrarySwapBumps {
        //             amm_token_accounts: AmmTokenAccountsBumps {},
        //             event_authority: ctx.bumps.event_authority,
        //         },
        //     ),
        //     arbitrary_params,
        // )?;

        Ok(())
    }

    pub fn validate(&self) -> Result<()> {
        let futarchy_amm = &self.futarchy_amm;

        // require!(
        //     futarchy_amm.live_proposal.is_some(),
        //     AutocratError::ProposalNotLive
        // );

        Ok(())
    }

    fn get_amm_token_account<'info>(
        amm_token_accounts: &AmmTokenAccounts<'info>,
        asset: Asset,
    ) -> AccountInfo<'info> {
        match asset {
            Asset::SpotQuote => amm_token_accounts.unconditional_quote.to_account_info(),
            Asset::SpotBase => amm_token_accounts.unconditional_base.to_account_info(),
            Asset::PassQuote => amm_token_accounts.pass_quote.to_account_info(),
            Asset::PassBase => amm_token_accounts.pass_base.to_account_info(),
            Asset::FailQuote => amm_token_accounts.fail_quote.to_account_info(),
            Asset::FailBase => amm_token_accounts.fail_base.to_account_info(),
        }
    }

    fn execute_trade(
        ctx: Context<Self>,
        params: TradeExecutionParams,
    ) -> Result<()> {
        msg!("{:?}", params);
        // First, pull the invariants
        let unconditional_k = ctx.accounts.amm_token_accounts.unconditional_base.amount as u128
            * ctx.accounts.amm_token_accounts.unconditional_quote.amount as u128;
        let pass_k = ctx.accounts.amm_token_accounts.pass_base.amount as u128
            * ctx.accounts.amm_token_accounts.pass_quote.amount as u128;
        let fail_k = ctx.accounts.amm_token_accounts.fail_base.amount as u128
            * ctx.accounts.amm_token_accounts.fail_quote.amount as u128;

        // Second, optimistically assume that the swap will succeed and do all the transfers and splits/merges

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


        let amm_output_account = Self::get_amm_token_account(
            &ctx.accounts.amm_token_accounts,
            params.output.asset,
        );

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: amm_output_account,
                    to: ctx.accounts.trader_output_account.to_account_info(),
                    authority: ctx.accounts.futarchy_amm.to_account_info(),
                },
                signer,
            ),
            params.output.amount,
        )?;

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
                    .unconditional_quote
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
            ctx.accounts.amm_token_accounts.fail_quote.to_account_info(),
            ctx.accounts.amm_token_accounts.pass_quote.to_account_info(),
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
                    .unconditional_base
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
            ctx.accounts.amm_token_accounts.fail_base.to_account_info(),
            ctx.accounts.amm_token_accounts.pass_base.to_account_info(),
        ]);

        if base_split_or_merge.split_or_merge == SplitOrMerge::Split {
            conditional_vault::cpi::split_tokens(base_cpi_context, base_split_or_merge.amount)?;
        } else {
            conditional_vault::cpi::merge_tokens(base_cpi_context, base_split_or_merge.amount)?;
        }

        // Third, check the invariants again

        ctx.accounts.amm_token_accounts.unconditional_quote.reload()?;
        ctx.accounts.amm_token_accounts.unconditional_base.reload()?;

        ctx.accounts.amm_token_accounts.pass_quote.reload()?;
        ctx.accounts.amm_token_accounts.pass_base.reload()?;

        ctx.accounts.amm_token_accounts.fail_quote.reload()?;
        ctx.accounts.amm_token_accounts.fail_base.reload()?;

        let unconditional_k_after = ctx.accounts.amm_token_accounts.unconditional_base.amount as u128
            * ctx.accounts.amm_token_accounts.unconditional_quote.amount as u128;
        let pass_k_after = ctx.accounts.amm_token_accounts.pass_base.amount as u128
            * ctx.accounts.amm_token_accounts.pass_quote.amount as u128;
        let fail_k_after = ctx.accounts.amm_token_accounts.fail_base.amount as u128
            * ctx.accounts.amm_token_accounts.fail_quote.amount as u128;

        require_gte!(unconditional_k_after, unconditional_k, AutocratError::InvariantViolation);
        require_gte!(pass_k_after, pass_k, AutocratError::InvariantViolation);
        require_gte!(fail_k_after, fail_k, AutocratError::InvariantViolation);

        Ok(())
    }
}
