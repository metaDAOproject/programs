# Gated Token Program — Technical Specification

Implementation reference for the program described in `vibes/gated-token-spec.md`. This document fixes the concrete shape of the Rust code: instructions, account structs, errors, events, and the test plan. It assumes the patterns established in `mint_governor` (the most recent comparable program: PDA-as-authority, freeze/mint authority delegation, per-mint config + per-(mint, principal) entry).

Companion documents:
- `vibes/gated-token-spec.md` — design rationale, threat model, integration patterns.
- `vibes/launchpad-v8-gating-integration-plan.md` — launchpad v8 integration details.

---

## 1. Crate

**Name:** `gated_token`
**Version:** `0.1.0`
**Anchor:** `0.29.0`
**Solana:** `1.17.34`

### 1.1 `Cargo.toml`

```toml
[package]
name = "gated_token"
version = "0.1.0"
description = "Created with Anchor"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "gated_token"

[features]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
cpi = ["no-entrypoint"]
default = []
production = []

[dependencies]
anchor-lang = { version = "0.29.0", features = ["init-if-needed", "event-cpi"] }
anchor-spl = "0.29.0"
solana-program = "=1.17.14"
spl-token = "=4.0.0"
solana-security-txt = "1.1.1"
```

The program does **not** depend on the whitelisted program crates. The whitelist is a `&[Pubkey]` of raw program IDs — depending on the crates would create a circular build graph (e.g. `launchpad_v8` lists `gated_token` as a CPI target, and would also depend on `gated_token` if `gated_token` depended on `launchpad_v8`).

### 1.2 Program ID

`GaTEjZy6eMdHg2BcL8dk3iE78jkJ9sPtyw1q2tMNi8PA`. Add to `Anchor.toml` under `[programs.localnet]`.

### 1.3 File layout

```
programs/gated_token/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── constants.rs
    ├── error.rs
    ├── events.rs
    ├── state/
    │   ├── mod.rs
    │   ├── gated_mint_config.rs
    │   └── whitelisted_user.rs
    └── instructions/
        ├── mod.rs
        ├── initialize_gated_mint.rs
        ├── add_whitelisted_user.rs
        ├── gated_invoke.rs
        ├── disable_gating.rs
        └── thaw_account.rs
```

---

## 2. Constants

PDA seed constants live alongside their account structs in `state/` (see §3). `constants.rs` only holds program-wide constants that don't belong to a single account.

`src/constants.rs`:

```rust
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::pubkey;

// Hardcoded program whitelist. Adding/removing programs requires a redeploy.
// Kept in sync with vibes/gated-token-spec.md §7.
pub const WHITELISTED_PROGRAMS: &[Pubkey] = &[
    pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), // spl_token
    pubkey!("FUTARELBfJfQ8RDGhg1wdhddq1odMAJUePHFuBYfUxKq"), // futarchy v0.6
    pubkey!("moonDJUoHteKkGATejA5bdJVwJ6V6Dg74gyqyJTx73n"), // launchpad_v8
    pubkey!("VLTX1ishMBbcX3rdBWGssxawAo1Q2X2qxYFYqiGodVg"), // conditional_vault v0.4
    pubkey!("WALL8ucBuUyL46QYxwYJjidaFYhdvxUFrgvBxPshERx"), // bid_wall v0.7
    pubkey!("gvnr27cVeyW3AVf3acL7VCJ5WjGAphytnsgcK1feHyH"), // mint_governor v0.7
    pubkey!("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG"), // damm_v2
];

// Raw SPL Token account layout offsets (TokenAccount, packed length 165).
pub const TOKEN_ACCOUNT_LEN: usize = 165;
pub const TOKEN_ACCOUNT_MINT_OFFSET: usize = 0;
pub const TOKEN_ACCOUNT_STATE_OFFSET: usize = 108;

// AccountState byte values (matches spl_token::state::AccountState repr).
pub const TOKEN_STATE_UNINITIALIZED: u8 = 0;
pub const TOKEN_STATE_INITIALIZED: u8 = 1;
pub const TOKEN_STATE_FROZEN: u8 = 2;
```

> Note on `WHITELISTED_PROGRAMS`: spec §7 also lists `damm_v2`; we use the runtime DAMM v2 program ID (the same value referenced in the SDK as `DAMM_V2_PROGRAM_ID`). This is **not** the `damm_v2_cpi` wrapper crate's program ID — that crate is a CPI helper, not a deployed program.
>
> `spl_token` is on the whitelist so whitelisted users can transfer / burn / approve / close their own gated-mint accounts via `gated_invoke`. Safety relies on `gated_invoke` using `invoke` (not `invoke_signed`) for the inner CPI: the gated_mint_config PDA never signs as the freeze authority for forwarded ixs, so `FreezeAccount` / `ThawAccount` / `SetAuthority(FreezeAccount)` calls routed through `gated_invoke` fail by missing-signature. `MintTo` similarly fails unless the caller holds the mint authority (which they don't under the recommended `mint_governor` setup). See `gated-token-spec.md` §13 for the full per-instruction analysis.

---

## 3. State / Account Structs

### 3.1 `GatedMintConfig`

`src/state/gated_mint_config.rs`:

```rust
use anchor_lang::prelude::*;

pub const GATED_MINT_CONFIG_SEED: &[u8] = b"gated_mint_config";

#[account]
#[derive(InitSpace)]
pub struct GatedMintConfig {
    /// The gated mint this config governs.
    pub mint: Pubkey,
    /// Manages the user whitelist; can call `disable_gating` (one-way).
    pub admin: Pubkey,
    /// Set true by `disable_gating`. Permanent. After this:
    ///   - `gated_invoke` errors
    ///   - `add_whitelisted_user` errors
    ///   - `thaw_account` becomes permissionless
    pub gating_disabled: bool,
    /// Monotonically incrementing sequence number for events.
    pub seq_num: u64,
    /// PDA bump cache.
    pub bump: u8,
}
```

**Seeds:** `[GATED_MINT_CONFIG_SEED, mint.as_ref()]` — single-instance per mint, no `create_key`. Unlike `mint_governor` (which is multi-instance per mint), only one gated config makes sense per mint: the mint can have at most one freeze authority, and that authority is the config PDA.

**Init space:** `8 + 32 + 32 + 1 + 8 + 1 = 82 bytes` (Anchor adds 8-byte discriminator).

### 3.2 `WhitelistedUser`

`src/state/whitelisted_user.rs`:

```rust
use anchor_lang::prelude::*;

pub const WHITELISTED_USER_SEED: &[u8] = b"whitelisted_user";

#[account]
#[derive(InitSpace)]
pub struct WhitelistedUser {
    /// The mint this whitelist entry applies to.
    pub mint: Pubkey,
    /// The user authorized to invoke `gated_invoke` for this mint.
    pub user: Pubkey,
    /// PDA bump cache.
    pub bump: u8,
}
```

**Seeds:** `[WHITELISTED_USER_SEED, mint.as_ref(), user.as_ref()]`.

**Existence == authorization.** No closure / removal instruction (append-only per spec §4 non-goals). Indexable off-chain via `getProgramAccounts` filtered by `mint` field at offset 8.

**Init space:** `8 + 32 + 32 + 1 = 73 bytes`.

### 3.3 `state/mod.rs`

```rust
pub mod gated_mint_config;
pub mod whitelisted_user;

pub use gated_mint_config::*;
pub use whitelisted_user::*;
```

---

## 4. Errors

`src/error.rs`:

```rust
use anchor_lang::prelude::*;

#[error_code]
pub enum GatedTokenError {
    #[msg("Unauthorized: signer is not the gated mint admin")]
    UnauthorizedAdmin,
    #[msg("Unauthorized: signer is not the current freeze authority of the mint")]
    UnauthorizedFreezeAuthority,
    #[msg("Mint mismatch: account does not match the expected gated mint")]
    MintMismatch,
    #[msg("Gating is already disabled for this mint")]
    GatingDisabled,
    #[msg("Gating must be disabled to call this instruction")]
    GatingNotDisabled,
    #[msg("Target program is not on the gated_token whitelist")]
    TargetProgramNotWhitelisted,
    #[msg("Target program may not be the gated_token program itself")]
    SelfInvocation,
    #[msg("Invalid token account: account is not a valid SPL Token account of the gated mint")]
    InvalidTokenAccount,
}
```

**Append-only.** Anchor encodes error discriminants by enum position, so new variants must be added at the end of the enum to avoid breaking deployed clients.

---

## 5. Events

`src/events.rs`:

```rust
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
    pub gated_mint_config_seq_num: u64,
}

impl CommonFields {
    pub fn new(clock: &Clock, seq_num: u64) -> Self {
        Self {
            slot: clock.slot,
            unix_timestamp: clock.unix_timestamp,
            gated_mint_config_seq_num: seq_num,
        }
    }
}

#[event]
pub struct GatedMintInitializedEvent {
    pub common: CommonFields,
    pub gated_mint_config: Pubkey,
    pub mint: Pubkey,
    pub admin: Pubkey,
    pub previous_freeze_authority: Pubkey,
    pub pda_bump: u8,
}

#[event]
pub struct WhitelistedUserAddedEvent {
    pub common: CommonFields,
    pub gated_mint_config: Pubkey,
    pub whitelisted_user: Pubkey,
    pub mint: Pubkey,
    pub user: Pubkey,
}

#[event]
pub struct GatedInvokeEvent {
    pub common: CommonFields,
    pub gated_mint_config: Pubkey,
    pub mint: Pubkey,
    pub caller: Pubkey,
    pub target_program: Pubkey,
    /// Number of remaining_accounts thawed in pre-CPI pass.
    pub thawed_count: u32,
    /// Number of remaining_accounts frozen in post-CPI pass.
    pub frozen_count: u32,
}

#[event]
pub struct GatingDisabledEvent {
    pub common: CommonFields,
    pub gated_mint_config: Pubkey,
    pub mint: Pubkey,
}

#[event]
pub struct AccountThawedEvent {
    pub common: CommonFields,
    pub gated_mint_config: Pubkey,
    pub mint: Pubkey,
    pub token_account: Pubkey,
}
```

All events emitted via `emit_cpi!` (matches `mint_governor` convention).

---

## 6. `lib.rs`

```rust
use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

pub use constants::*;
pub use error::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "gated_token",
    project_url: "https://metadao.fi",
    contacts: "telegram:metaproph3t,telegram:kollan_house",
    source_code: "https://github.com/metaDAOproject/programs",
    source_release: "v0.1.0",
    policy: "The market will decide whether we pay a bug bounty.",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("GaTEjZy6eMdHg2BcL8dk3iE78jkJ9sPtyw1q2tMNi8PA");

#[program]
pub mod gated_token {
    use super::*;

    #[access_control(ctx.accounts.validate())]
    pub fn initialize_gated_mint(ctx: Context<InitializeGatedMint>) -> Result<()> {
        InitializeGatedMint::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn add_whitelisted_user(ctx: Context<AddWhitelistedUser>) -> Result<()> {
        AddWhitelistedUser::handle(ctx)
    }

    #[access_control(ctx.accounts.validate(&args))]
    pub fn gated_invoke<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, GatedInvoke<'info>>,
        args: GatedInvokeArgs,
    ) -> Result<()> {
        GatedInvoke::handle(ctx, args)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn disable_gating(ctx: Context<DisableGating>) -> Result<()> {
        DisableGating::handle(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn thaw_account(ctx: Context<ThawAccount>) -> Result<()> {
        ThawAccount::handle(ctx)
    }
}
```

---

## 7. Instructions

### 7.1 `initialize_gated_mint`

Sets up `GatedMintConfig` for a new gated mint and CPIs `spl_token::set_authority` to transfer freeze authority from the current authority signer to the config PDA.

**`src/instructions/initialize_gated_mint.rs`:**

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::spl_token::instruction::AuthorityType;
use anchor_spl::token::{self, Mint, SetAuthority, Token};

use crate::{
    CommonFields, GatedMintConfig, GatedMintInitializedEvent, GatedTokenError,
    GATED_MINT_CONFIG_SEED,
};

#[event_cpi]
#[derive(Accounts)]
pub struct InitializeGatedMint<'info> {
    #[account(
        mut,
        mint::freeze_authority = current_freeze_authority @ GatedTokenError::UnauthorizedFreezeAuthority,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        space = 8 + GatedMintConfig::INIT_SPACE,
        seeds = [GATED_MINT_CONFIG_SEED, mint.key().as_ref()],
        bump,
    )]
    pub gated_mint_config: Account<'info, GatedMintConfig>,

    /// Verified by the `mint::freeze_authority` constraint above. Signs the set_authority CPI.
    pub current_freeze_authority: Signer<'info>,

    /// CHECK: stored on GatedMintConfig as the per-mint admin.
    pub admin: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl InitializeGatedMint<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let previous_authority = ctx.accounts.current_freeze_authority.key();
        let config_key = ctx.accounts.gated_mint_config.key();

        // Transfer freeze authority to the gated_mint_config PDA.
        token::set_authority(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                SetAuthority {
                    current_authority: ctx.accounts.current_freeze_authority.to_account_info(),
                    account_or_mint: ctx.accounts.mint.to_account_info(),
                },
            ),
            AuthorityType::FreezeAccount,
            Some(config_key),
        )?;

        ctx.accounts.gated_mint_config.set_inner(GatedMintConfig {
            mint: ctx.accounts.mint.key(),
            admin: ctx.accounts.admin.key(),
            gating_disabled: false,
            seq_num: 0,
            bump: ctx.bumps.gated_mint_config,
        });

        let clock = Clock::get()?;
        let cfg = &ctx.accounts.gated_mint_config;
        emit_cpi!(GatedMintInitializedEvent {
            common: CommonFields::new(&clock, cfg.seq_num),
            gated_mint_config: config_key,
            mint: cfg.mint,
            admin: cfg.admin,
            previous_freeze_authority: previous_authority,
            pda_bump: cfg.bump,
        });

        Ok(())
    }
}
```

**Notes:**
- Mirrors `mint_governor::transfer_authority_to_governor` and `initialize_mint_governor` combined into a single instruction. This is intentional: we want the freeze-authority transfer to happen at the same time as the config init so there is no front-run window where the mint has freeze authority transferred to the PDA but no config exists.
- Errors if `mint.freeze_authority` is `None`. There is no point in initializing a config for a mint that cannot be frozen.
- `seq_num` starts at 0 and is incremented in subsequent state-changing instructions.

### 7.2 `add_whitelisted_user`

Creates a `WhitelistedUser` PDA for `(mint, user)`. Signed by `gated_mint_config.admin`.

**`src/instructions/add_whitelisted_user.rs`:**

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::{
    CommonFields, GatedMintConfig, GatedTokenError, WhitelistedUser,
    WhitelistedUserAddedEvent, WHITELISTED_USER_SEED,
};

#[event_cpi]
#[derive(Accounts)]
pub struct AddWhitelistedUser<'info> {
    #[account(
        mut,
        has_one = mint @ GatedTokenError::MintMismatch,
        constraint = !gated_mint_config.gating_disabled @ GatedTokenError::GatingDisabled,
    )]
    pub gated_mint_config: Account<'info, GatedMintConfig>,

    #[account(address = gated_mint_config.admin @ GatedTokenError::UnauthorizedAdmin)]
    pub admin: Signer<'info>,

    pub mint: Account<'info, Mint>,

    /// CHECK: any pubkey may be whitelisted; not signed.
    pub user: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + WhitelistedUser::INIT_SPACE,
        seeds = [WHITELISTED_USER_SEED, mint.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub whitelisted_user: Account<'info, WhitelistedUser>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl AddWhitelistedUser<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let cfg = &mut ctx.accounts.gated_mint_config;
        cfg.seq_num += 1;

        ctx.accounts.whitelisted_user.set_inner(WhitelistedUser {
            mint: ctx.accounts.mint.key(),
            user: ctx.accounts.user.key(),
            bump: ctx.bumps.whitelisted_user,
        });

        let clock = Clock::get()?;
        emit_cpi!(WhitelistedUserAddedEvent {
            common: CommonFields::new(&clock, cfg.seq_num),
            gated_mint_config: cfg.key(),
            whitelisted_user: ctx.accounts.whitelisted_user.key(),
            mint: ctx.accounts.mint.key(),
            user: ctx.accounts.user.key(),
        });

        Ok(())
    }
}
```

**Notes:**
- `init` on `whitelisted_user` causes a re-entry check: if the PDA already exists, Anchor errors. This is correct behavior — re-adding the same user is a no-op and we surface it as an explicit failure to make scripts deterministic.
- `payer` separate from `admin` so the admin can be a Squads multisig PDA that can't pay rent directly.

### 7.3 `gated_invoke`

The wrapper. The hot path: validates caller + target program, thaws gated-mint token accounts in `remaining_accounts`, CPIs the target, refreezes.

**`src/instructions/gated_invoke.rs`:**

```rust
use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::{invoke, invoke_signed};
use anchor_spl::token::spl_token;
use anchor_spl::token::Mint;

use crate::{
    CommonFields, GatedInvokeEvent, GatedMintConfig, GatedTokenError, WhitelistedUser,
    GATED_MINT_CONFIG_SEED, TOKEN_ACCOUNT_LEN, TOKEN_ACCOUNT_MINT_OFFSET,
    TOKEN_ACCOUNT_STATE_OFFSET, TOKEN_STATE_FROZEN, TOKEN_STATE_INITIALIZED,
    WHITELISTED_PROGRAMS, WHITELISTED_USER_SEED,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GatedInvokeArgs {
    /// Raw instruction data forwarded verbatim to the target program.
    pub instruction_data: Vec<u8>,
}

#[event_cpi]
#[derive(Accounts)]
pub struct GatedInvoke<'info> {
    pub caller: Signer<'info>,

    #[account(
        has_one = mint @ GatedTokenError::MintMismatch,
        constraint = !gated_mint_config.gating_disabled @ GatedTokenError::GatingDisabled,
    )]
    pub gated_mint_config: Account<'info, GatedMintConfig>,

    /// Existence == caller is whitelisted for this mint.
    /// Anchor verifies discriminator + seeds + bump.
    #[account(
        seeds = [WHITELISTED_USER_SEED, mint.key().as_ref(), caller.key().as_ref()],
        bump = whitelisted_user.bump,
        has_one = mint @ GatedTokenError::MintMismatch,
        constraint = whitelisted_user.user == caller.key() @ GatedTokenError::UnauthorizedAdmin,
    )]
    pub whitelisted_user: Account<'info, WhitelistedUser>,

    pub mint: Account<'info, Mint>,

    /// CHECK: validated against WHITELISTED_PROGRAMS.
    pub target_program: UncheckedAccount<'info>,

    /// CHECK: must be spl_token program; used for freeze/thaw CPI.
    #[account(address = spl_token::ID)]
    pub token_program: UncheckedAccount<'info>,
    // remaining_accounts: forwarded verbatim to the target CPI.
}

impl<'info, 'c: 'info> GatedInvoke<'info> {
    pub fn validate(&self, _args: &GatedInvokeArgs) -> Result<()> {
        let target = self.target_program.key();
        require!(
            WHITELISTED_PROGRAMS.contains(&target),
            GatedTokenError::TargetProgramNotWhitelisted
        );
        require_keys_neq!(target, crate::ID, GatedTokenError::SelfInvocation);
        Ok(())
    }

    pub fn handle(
        ctx: Context<'_, '_, 'c, 'info, Self>,
        args: GatedInvokeArgs,
    ) -> Result<()> {
        let mint_key = ctx.accounts.mint.key();
        let cfg_key = ctx.accounts.gated_mint_config.key();
        let cfg_bump = ctx.accounts.gated_mint_config.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[
            GATED_MINT_CONFIG_SEED,
            mint_key.as_ref(),
            &[cfg_bump],
        ]];

        // ── Pre-CPI thaw pass ─────────────────────────────────────────────
        let mut thawed_count: u32 = 0;
        for acc in ctx.remaining_accounts.iter() {
            if !is_gated_token_account(acc, &mint_key)? {
                continue;
            }
            if read_token_state(acc)? != TOKEN_STATE_FROZEN {
                continue;
            }
            cpi_thaw(
                &ctx.accounts.token_program.to_account_info(),
                acc,
                &ctx.accounts.mint.to_account_info(),
                &ctx.accounts.gated_mint_config.to_account_info(),
                signer_seeds,
            )?;
            thawed_count = thawed_count.saturating_add(1);
        }

        // ── Inner CPI ─────────────────────────────────────────────────────
        // IMPORTANT: invoke (not invoke_signed). We do NOT add the program
        // as signer to the inner CPI — caller's signature propagates from
        // the outer transaction.
        let account_metas: Vec<AccountMeta> = ctx
            .remaining_accounts
            .iter()
            .map(|a| AccountMeta {
                pubkey: a.key(),
                is_signer: a.is_signer,
                is_writable: a.is_writable,
            })
            .collect();
        let mut account_infos: Vec<AccountInfo> = ctx.remaining_accounts.to_vec();
        account_infos.push(ctx.accounts.target_program.to_account_info());

        let ix = Instruction {
            program_id: ctx.accounts.target_program.key(),
            accounts: account_metas,
            data: args.instruction_data,
        };
        invoke(&ix, &account_infos)?;

        // ── Post-CPI freeze pass ──────────────────────────────────────────
        // Iterate from scratch — inner CPI may have initialized new gated
        // token accounts that pre-CPI couldn't see.
        let mut frozen_count: u32 = 0;
        for acc in ctx.remaining_accounts.iter() {
            if !is_gated_token_account(acc, &mint_key)? {
                continue;
            }
            if read_token_state(acc)? != TOKEN_STATE_INITIALIZED {
                continue;
            }
            cpi_freeze(
                &ctx.accounts.token_program.to_account_info(),
                acc,
                &ctx.accounts.mint.to_account_info(),
                &ctx.accounts.gated_mint_config.to_account_info(),
                signer_seeds,
            )?;
            frozen_count = frozen_count.saturating_add(1);
        }

        // ── Event ─────────────────────────────────────────────────────────
        let cfg = &mut ctx.accounts.gated_mint_config;
        cfg.seq_num += 1;
        let clock = Clock::get()?;
        emit_cpi!(GatedInvokeEvent {
            common: CommonFields::new(&clock, cfg.seq_num),
            gated_mint_config: cfg_key,
            mint: mint_key,
            caller: ctx.accounts.caller.key(),
            target_program: ctx.accounts.target_program.key(),
            thawed_count,
            frozen_count,
        });

        Ok(())
    }
}
```

**Helper functions** (same file, private):

```rust
/// True if `acc` is owned by spl_token, has the expected length,
/// and its mint field matches `expected_mint`. No Anchor deserialization.
fn is_gated_token_account(acc: &AccountInfo, expected_mint: &Pubkey) -> Result<bool> {
    if acc.owner != &spl_token::ID {
        return Ok(false);
    }
    let data = acc.try_borrow_data()?;
    if data.len() != TOKEN_ACCOUNT_LEN {
        return Ok(false);
    }
    let mint_bytes: &[u8; 32] = data
        [TOKEN_ACCOUNT_MINT_OFFSET..TOKEN_ACCOUNT_MINT_OFFSET + 32]
        .try_into()
        .unwrap();
    Ok(Pubkey::from(*mint_bytes) == *expected_mint)
}

/// Reads the AccountState byte at offset 108. Caller must have already
/// confirmed `is_gated_token_account`.
fn read_token_state(acc: &AccountInfo) -> Result<u8> {
    let data = acc.try_borrow_data()?;
    Ok(data[TOKEN_ACCOUNT_STATE_OFFSET])
}

fn cpi_thaw<'info>(
    token_program: &AccountInfo<'info>,
    account: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let ix = spl_token::instruction::thaw_account(
        &spl_token::ID,
        account.key,
        mint.key,
        authority.key,
        &[],
    )?;
    invoke_signed(
        &ix,
        &[
            account.clone(),
            mint.clone(),
            authority.clone(),
            token_program.clone(),
        ],
        signer_seeds,
    )?;
    Ok(())
}

fn cpi_freeze<'info>(
    token_program: &AccountInfo<'info>,
    account: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let ix = spl_token::instruction::freeze_account(
        &spl_token::ID,
        account.key,
        mint.key,
        authority.key,
        &[],
    )?;
    invoke_signed(
        &ix,
        &[
            account.clone(),
            mint.clone(),
            authority.clone(),
            token_program.clone(),
        ],
        signer_seeds,
    )?;
    Ok(())
}
```

**Notes / invariants:**
- `caller`, `gated_mint_config`, `mint`, `target_program`, `token_program`, `whitelisted_user`, plus all event-CPI accounts are the **only** named accounts. Everything else is `remaining_accounts`, forwarded verbatim.
- The wrapper does not own/check the inner instruction's account layout. The caller is responsible for ordering `remaining_accounts` correctly for the target program.
- We use `invoke` (not `invoke_signed`) for the inner CPI: the program adds **no** signer authority to the call. The caller's outer-tx signature propagates naturally to any `is_signer: true` entry whose pubkey matches the caller.
- `invoke_signed` is used **only** for `freeze_account` / `thaw_account`, where the gated_mint_config PDA is the freeze authority.
- Aliased duplicates in `remaining_accounts` self-handle: the `state-before-action` check causes the second occurrence to skip.
- Pre-CPI rejects non-frozen gated-mint accounts (no `thaw` is needed). Post-CPI rejects already-frozen accounts. Both passes also reject non-gated-mint accounts, so an attacker passing arbitrary mints' token accounts in `remaining_accounts` does not cause spurious thaws.
- The handler reborrows `gated_mint_config` mutably at the end to bump `seq_num`. Account mutability propagates because `Account<'info, T>` derives `Deref` and Anchor's `mut` constraint already marks it writable. No additional `#[account(mut)]` is needed if `seq_num` matters; **it does** — add `mut` to the `gated_mint_config` constraint above.

> **Correction to the constraint snippet above:** the `gated_mint_config` constraint must include `mut` since we increment `seq_num`. Final form:
> ```rust
> #[account(
>     mut,
>     has_one = mint @ GatedTokenError::MintMismatch,
>     constraint = !gated_mint_config.gating_disabled @ GatedTokenError::GatingDisabled,
> )]
> pub gated_mint_config: Account<'info, GatedMintConfig>,
> ```

### 7.4 `disable_gating`

Admin sets `gating_disabled = true`. One-way.

**`src/instructions/disable_gating.rs`:**

```rust
use anchor_lang::prelude::*;

use crate::{CommonFields, GatedMintConfig, GatedTokenError, GatingDisabledEvent};

#[event_cpi]
#[derive(Accounts)]
pub struct DisableGating<'info> {
    #[account(
        mut,
        constraint = !gated_mint_config.gating_disabled @ GatedTokenError::GatingDisabled,
    )]
    pub gated_mint_config: Account<'info, GatedMintConfig>,

    #[account(address = gated_mint_config.admin @ GatedTokenError::UnauthorizedAdmin)]
    pub admin: Signer<'info>,
}

impl DisableGating<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let cfg = &mut ctx.accounts.gated_mint_config;
        cfg.gating_disabled = true;
        cfg.seq_num += 1;

        let clock = Clock::get()?;
        emit_cpi!(GatingDisabledEvent {
            common: CommonFields::new(&clock, cfg.seq_num),
            gated_mint_config: cfg.key(),
            mint: cfg.mint,
        });

        Ok(())
    }
}
```

### 7.5 `thaw_account`

Permissionless after `gating_disabled == true`. Anyone may call to thaw any gated-mint token account.

**`src/instructions/thaw_account.rs`:**

```rust
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::spl_token;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    AccountThawedEvent, CommonFields, GatedMintConfig, GatedTokenError,
    GATED_MINT_CONFIG_SEED,
};

#[event_cpi]
#[derive(Accounts)]
pub struct ThawAccount<'info> {
    #[account(
        mut,
        has_one = mint @ GatedTokenError::MintMismatch,
        constraint = gated_mint_config.gating_disabled @ GatedTokenError::GatingNotDisabled,
    )]
    pub gated_mint_config: Account<'info, GatedMintConfig>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = token_account.mint == mint.key() @ GatedTokenError::MintMismatch,
    )]
    pub token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl ThawAccount<'_> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let cfg = &mut ctx.accounts.gated_mint_config;
        let mint_key = ctx.accounts.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            GATED_MINT_CONFIG_SEED,
            mint_key.as_ref(),
            &[cfg.bump],
        ]];

        let ix = spl_token::instruction::thaw_account(
            &spl_token::ID,
            &ctx.accounts.token_account.key(),
            &mint_key,
            &cfg.key(),
            &[],
        )?;
        invoke_signed(
            &ix,
            &[
                ctx.accounts.token_account.to_account_info(),
                ctx.accounts.mint.to_account_info(),
                cfg.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        cfg.seq_num += 1;
        let clock = Clock::get()?;
        emit_cpi!(AccountThawedEvent {
            common: CommonFields::new(&clock, cfg.seq_num),
            gated_mint_config: cfg.key(),
            mint: mint_key,
            token_account: ctx.accounts.token_account.key(),
        });

        Ok(())
    }
}
```

**Notes:**
- Idempotent failure mode: calling on an already-thawed account produces an SPL Token error (state mismatch). Acceptable — clients can check beforehand.
- We use `Account<'info, TokenAccount>` here (not raw `AccountInfo`) because there's only one account to validate and Anchor's deserialization is fine. This differs from `gated_invoke`'s remaining_accounts loop where we need to handle freshly-created accounts and avoid the cost of full deserialization.

### 7.6 `instructions/mod.rs`

```rust
pub mod add_whitelisted_user;
pub mod disable_gating;
pub mod gated_invoke;
pub mod initialize_gated_mint;
pub mod thaw_account;

pub use add_whitelisted_user::*;
pub use disable_gating::*;
pub use gated_invoke::*;
pub use initialize_gated_mint::*;
pub use thaw_account::*;
```

---

## 8. SDK shape

Following the `mint_governor` v0.7 pattern: one module under `sdk/src/gated_token/v0.1/` with a `GatedTokenClient` class, PDA helpers, and re-generated Anchor types.

### 8.1 PDAs (`sdk/src/gated_token/v0.1/pda.ts`)

```ts
export const getGatedMintConfigAddr = ({
  programId = GATED_TOKEN_V0_1_PROGRAM_ID,
  mint,
}: { programId?: PublicKey; mint: PublicKey }) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("gated_mint_config"), mint.toBuffer()],
    programId,
  );

export const getWhitelistedUserAddr = ({
  programId = GATED_TOKEN_V0_1_PROGRAM_ID,
  mint,
  user,
}: { programId?: PublicKey; mint: PublicKey; user: PublicKey }) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("whitelisted_user"), mint.toBuffer(), user.toBuffer()],
    programId,
  );
```

### 8.2 Client methods

```ts
class GatedTokenClient {
  static createClient(params: { provider: AnchorProvider; programId?: PublicKey }): GatedTokenClient;

  // Account fetching
  fetchGatedMintConfig(addr: PublicKey): Promise<GatedMintConfigAccount | null>;
  fetchWhitelistedUser(addr: PublicKey): Promise<WhitelistedUserAccount | null>;

  // Instruction builders (return MethodsBuilder, callable as `.signers([...]).rpc()`).
  initializeGatedMintIx(params: {
    mint: PublicKey;
    currentFreezeAuthority: PublicKey;
    admin: PublicKey;
    payer?: PublicKey;
  }): MethodsBuilder;

  addWhitelistedUserIx(params: {
    mint: PublicKey;
    admin: PublicKey;
    user: PublicKey;
    payer?: PublicKey;
  }): MethodsBuilder;

  // The wrapper. `instructionData` is the serialized inner instruction.
  // `remainingAccounts` is the inner instruction's account list.
  gatedInvokeIx(params: {
    caller: PublicKey;
    mint: PublicKey;
    targetProgram: PublicKey;
    instructionData: Buffer;
    remainingAccounts: AccountMeta[];
  }): MethodsBuilder;

  disableGatingIx(params: { mint: PublicKey; admin: PublicKey }): MethodsBuilder;

  thawAccountIx(params: { mint: PublicKey; tokenAccount: PublicKey }): MethodsBuilder;
}
```

A higher-level helper `wrapInstruction(ix: TransactionInstruction): TransactionInstruction` that takes a freshly-built instruction (e.g. from `LaunchpadClient.claimIx({...}).instruction()`) and rewrites it into a `gated_invoke` call would be ergonomic. Out of scope for v0.1 of the SDK; integration callers can compose manually.

### 8.3 Constants (`sdk/src/constants.ts`)

```ts
export const GATED_TOKEN_V0_1_PROGRAM_ID = new PublicKey(
  "GaTEjZy6eMdHg2BcL8dk3iE78jkJ9sPtyw1q2tMNi8PA",
);
```

### 8.4 Top-level re-export (`sdk/src/index.ts`)

Re-export `GatedTokenClient`, the PDA helpers, and the program ID.

### 8.5 IDL plumbing — `sdk/sync-types.sh`

The SDK does **not** import IDL types from `target/types/` directly. Instead, `sdk/sync-types.sh` (run by `yarn build-local` inside `./rebuild.sh`) copies each program's generated IDL `.ts` file into the corresponding SDK module's `types/` directory, where a hand-written `index.ts` re-exports it with `IdlAccounts`/`IdlEvents`-derived types.

**A new line must be added to `sdk/sync-types.sh`:**

```bash
cp "$TYPES_DIR/gated_token.ts" ./src/gated_token/v0.1/types/
```

Without this line, `./rebuild.sh` will not propagate the program IDL into the SDK and the `GatedTokenClient` will fail to compile.

The accompanying hand-written `sdk/src/gated_token/v0.1/types/index.ts` follows the `mint_governor` pattern:

```ts
import { IdlAccounts, IdlEvents } from "@coral-xyz/anchor";
import {
  GatedToken as GatedTokenProgram,
  IDL as GatedTokenIDL,
} from "./gated_token.js";
export { GatedTokenProgram, GatedTokenIDL };

export type GatedMintConfigAccount =
  IdlAccounts<GatedTokenProgram>["gatedMintConfig"];
export type WhitelistedUserAccount =
  IdlAccounts<GatedTokenProgram>["whitelistedUser"];

export type GatedMintInitializedEvent =
  IdlEvents<GatedTokenProgram>["GatedMintInitializedEvent"];
export type WhitelistedUserAddedEvent =
  IdlEvents<GatedTokenProgram>["WhitelistedUserAddedEvent"];
export type GatedInvokeEvent =
  IdlEvents<GatedTokenProgram>["GatedInvokeEvent"];
export type GatingDisabledEvent =
  IdlEvents<GatedTokenProgram>["GatingDisabledEvent"];
export type AccountThawedEvent =
  IdlEvents<GatedTokenProgram>["AccountThawedEvent"];
export type GatedTokenEvent =
  | GatedMintInitializedEvent
  | WhitelistedUserAddedEvent
  | GatedInvokeEvent
  | GatingDisabledEvent
  | AccountThawedEvent;
```

---

## 9. Testing

### 9.1 Layout

```
tests/gatedToken/
├── main.test.ts
├── utils.ts
└── unit/
    ├── initializeGatedMint.test.ts
    ├── addWhitelistedUser.test.ts
    ├── gatedInvoke.test.ts
    ├── disableGating.test.ts
    └── thawAccount.test.ts
```

Wire `main.test.ts` into `tests/main.test.ts` as a top-level `describe`. Follow the `tests/mintGovernor/main.test.ts` pattern (per-instruction `describe` blocks dispatched to `unit/*.test.ts` files).

### 9.2 `tests/gatedToken/utils.ts`

Helpers similar to `tests/mintGovernor/utils.ts`:

- `createMintWithFreezeAuthority(banksClient, payer, mintAuthority, freezeAuthority, decimals)` — variant of `createMintWithAuthority` that sets a non-null freeze authority.
- `setupGatedMint(banksClient, gatedTokenClient, payer, admin?, decimals?)` — creates a mint with payer as freeze authority, calls `initialize_gated_mint`, returns `{ mint, gatedMintConfig, admin }`.
- `whitelistUser(gatedTokenClient, mint, admin, user, payer)` — wrapper around `add_whitelisted_user`.

### 9.3 Per-instruction test cases

#### `initialize_gated_mint`
- ✅ Successfully initializes: `GatedMintConfig` exists at the expected PDA with `mint`, `admin`, `gating_disabled = false`, `seq_num = 0`, `bump` populated correctly, **and** `mint.freeze_authority` equals the config PDA after the call.
- ❌ Fails when `mint.freeze_authority` is `None` (`UnauthorizedFreezeAuthority` — `mint::freeze_authority` constraint).
- ❌ Fails when signer is not the current freeze authority (`UnauthorizedFreezeAuthority`).
- ❌ Fails when re-initializing the same mint (Anchor `init` collision).

#### `add_whitelisted_user`
- ✅ Admin successfully whitelists a new user. Use a payer distinct from the admin to also exercise the `payer ≠ admin` path. PDA exists at the expected address with correct `mint`, `user`, `bump`.
- ❌ Non-admin cannot whitelist (`UnauthorizedAdmin`).
- ❌ Re-adding an existing user fails (Anchor `init` collision).
- ❌ Fails after `disable_gating` (`GatingDisabled`).
- ✅ Distinct mints have independent whitelists (whitelisting U for mint A does not whitelist U for mint B — `gated_invoke` for mint B with caller U fails).

#### `gated_invoke` — happy path

Use `spl_token::transfer` as the **primary** inner ix for happy-path tests. It's the simplest whitelisted CPI to set up: pre-mint tokens to a source ATA owned by Alice (a whitelisted user), include both ATAs in `remaining_accounts`, transfer Alice → Bob (also whitelisted), assert balances + frozen state on both ends.

- ✅ **Transfer between whitelisted users.** Alice (whitelisted) calls `gated_invoke(token::transfer)` to send to Bob (whitelisted). Pre-existing Alice ATA (force-frozen via `setAccount`) is thawed pre-CPI, transfer succeeds, both ATAs end up frozen post-CPI. Asserts: balances correct, both ATAs `Frozen`, `GatedInvokeEvent.thawed_count == 1` and `frozen_count == 2` (or whatever the setup dictates).
- ✅ **Pre-existing frozen ATA passed in `remaining_accounts` ends up frozen post-CPI.** Covered by the transfer test above.
- ✅ **Newly-created ATA (initialized inside the inner CPI via an `init_if_needed` token account) ends up frozen post-CPI.** This case can't be exercised through `token::transfer` (which requires both accounts to pre-exist), so use `mint_governor::mint_tokens` here: set up a `mint_governor` for the gated mint with an authorized minter, omit the recipient ATA from setup, and `gated_invoke(mint_governor::mint_tokens)`. The recipient ATA is created by `init_if_needed` inside the inner CPI; the post-CPI freeze pass must catch it.
- ✅ **Aliased duplicate accounts in `remaining_accounts`** are handled (no double-thaw or double-freeze error). Use `token::transfer` and pass the source ATA twice.
- ✅ **Non-gated-mint token accounts in `remaining_accounts`** are untouched (e.g. a quote-mint USDC ATA included alongside the transfer).

#### `gated_invoke` — failure modes
- ❌ Non-whitelisted target program (use `system_program::ID`) (`TargetProgramNotWhitelisted`).
- ❌ Non-whitelisted caller (caller has no `WhitelistedUser` PDA) — Anchor `AccountNotInitialized` (or analog).
- ❌ Caller is whitelisted for mint A but invokes for mint B — fails because Anchor seeds for `whitelisted_user` won't match.
- ❌ `target_program == gated_token::ID` (`SelfInvocation`).
- ❌ `gating_disabled == true` (`GatingDisabled`).
- ❌ Inner CPI itself fails: state should roll back (no thaws should "stick"). Easy to force with `token::transfer` by making the source ATA's balance smaller than the transfer amount — the SPL Token program returns `InsufficientFunds` and the transaction unwinds, leaving the source ATA in its pre-tx (frozen) state.
- ❌ Caller is not signer for outer transaction — Anchor signer constraint fails.

#### `gated_invoke` — privilege-escalation guard
- ❌ Caller A constructs a `gated_invoke` whose `remaining_accounts` includes a `Signer` AccountMeta for caller B (who didn't sign the outer tx). The runtime must reject because B did not actually sign — confirming the wrapper does not impersonate.
- ❌ Similarly: the wrapper does not silently sign as the gated_token program for the inner CPI; trying to use the gated_token program as a signer in the inner ix fails.

#### `disable_gating`
- ✅ Admin can disable gating: `gated_mint_config.gating_disabled == true` after the call. Downstream effects (`gated_invoke` / `add_whitelisted_user` rejecting, `thaw_account` becoming callable) are covered in those instructions' own suites.
- ❌ Non-admin cannot disable (`UnauthorizedAdmin`).
- ❌ Cannot disable twice (`GatingDisabled`).

#### `thaw_account`
- ❌ Cannot call before `disable_gating` (`GatingNotDisabled`).
- ✅ After `disable_gating`: anyone (any signer, including a fresh keypair) can thaw a frozen gated-mint token account.
- ✅ Already-thawed account — calling again returns SPL Token error.
- ❌ Account whose mint is not the gated mint (`MintMismatch`).

### 9.4 Bankrun setup

Use `solana-bankrun` and the existing `BankrunProvider` shape from `tests/mintGovernor/main.test.ts`. The gated_token tests need:
- The SPL Token program (always loaded by bankrun) for the primary `gated_invoke` happy-path target via `token::transfer`.
- The `mint_governor` deployment (already in fixtures via `Anchor.toml`) for the "newly-created ATA via `init_if_needed`" test case.
- A non-whitelisted program: `system_program::ID` works for that negative test.

### 9.5 Integration test (cross-program)

Add `tests/integration/gatedLaunchpadV8.test.ts`:
- End-to-end: create a gated mint, set freeze authority to expected PDA, `initialize_gated_mint`, `add_whitelisted_user`, `gated_invoke(launchpad_v8::initialize_launch)`, verify `launch_base_vault` is frozen.
- Verify `launchpad_v8::start_launch` (direct, not wrappered) succeeds.
- Verify `launchpad_v8::fund` (direct) succeeds (USDC only).
- Verify `gated_invoke(launchpad_v8::settle_launch)` ends with frozen `launch_base_vault`, frozen futarchy AMM base vault, and frozen DAMM v2 `token_a_vault`.
- Verify `gated_invoke(launchpad_v8::claim)` for a whitelisted funder ends with the funder's claim ATA frozen.

This belongs in a follow-up integration phase rather than the gated_token program's unit tests; flagging it here so it's not forgotten.

### 9.6 Test discipline

- Per `CLAUDE.md`: add `.only` to the test under development; remove before merging; finish with `./rebuild.sh && anchor test --skip-build`.
- No assertion messages (the assertion itself reads); keep messages on `expectError` and `assert.fail` paths.
- Use round-number token amounts (e.g. `100_000_000` for 100 tokens at 6 decimals).

---

## 10. Implementation checklist

In rough dependency order. Each instruction step bundles **program impl + SDK builder + unit tests** so that nothing lands without a typed client to call it.

1. **Scaffold** — both program and SDK at the same time:
   - Program: `programs/gated_token/Cargo.toml`, `Anchor.toml` entry under `[programs.localnet]`, `lib.rs` with `declare_id!`, `security_txt!`, empty module imports.
   - SDK module skeleton: `sdk/src/gated_token/v0.1/` with empty `GatedTokenClient.ts`, `pda.ts` (PDA helpers can land now since seeds are fixed), `types/index.ts` (re-export pattern from §8.5), `index.ts`.
   - SDK plumbing — **must not be skipped or `./rebuild.sh` won't wire the IDL through**:
     - Add `cp "$TYPES_DIR/gated_token.ts" ./src/gated_token/v0.1/types/` to `sdk/sync-types.sh`.
     - Add `GATED_TOKEN_V0_1_PROGRAM_ID` to `sdk/src/constants.ts`.
     - Add `"./gated_token"` and `"./gated_token/*"` entries to the `exports` map in `sdk/package.json`.
     - Re-export the client and PDA helpers from `sdk/src/index.ts`.
   - Verify: `./rebuild.sh` succeeds end-to-end with the empty scaffold and `sdk/src/gated_token/v0.1/types/gated_token.ts` exists after the run.
2. Add program-side `constants.rs` (`WHITELISTED_PROGRAMS`, raw token-account offsets).
3. Implement state structs (`gated_mint_config`, `whitelisted_user`) — seeds live alongside their structs (§3).
4. Implement `error.rs`, `events.rs`.
5. **`initialize_gated_mint`**: program impl + `GatedTokenClient.initializeGatedMintIx` + unit tests.
6. **`add_whitelisted_user`**: program impl + `addWhitelistedUserIx` + unit tests.
7. **`disable_gating`**: program impl + `disableGatingIx` + unit tests.
8. **`thaw_account`**: program impl + `thawAccountIx` + unit tests.
9. **`gated_invoke`** (the heavy lift): program impl + `gatedInvokeIx` + unit tests.
   - Program: helper functions for raw token-account inspection, CPI thaw/freeze with PDA signing, inner-CPI construction without program-as-signer.
   - SDK: builder accepts `targetProgram`, `instructionData`, and a pre-formed `remainingAccounts: AccountMeta[]`.
10. Integration tests with `mint_governor` (cross-program happy path of `gated_invoke`).
11. Integration tests with `launchpad_v8` (companion plan).
12. Threat-model walkthrough against spec §13 — confirm each item in code or in a documented compensating control.

After every step that touches Rust code, run `./rebuild.sh` so the SDK type bindings stay in sync; after every step that touches tests, isolate with `.only` per `CLAUDE.md` and finish with the full suite.
