# Gated Token Program — Specification

## 1. Summary

A Solana program that holds the freeze authority over a token mint and gates all token movements through two simultaneous filters:

1. A **fixed program whitelist** restricting which target programs can be invoked through the wrapper.
2. A **per-mint user whitelist** restricting which user keys may sign a wrapper call for a given mint.

By default, all token accounts of a gated mint are frozen. The only way to move tokens is to invoke a whitelisted program *through* this program, which thaws the relevant accounts immediately before the inner CPI and re-freezes them immediately after.

The gating period for a given mint is time-bounded: the per-mint admin can permanently disable gating, after which the mint behaves as a regular SPL Token.

## 2. Motivation

The launchpad launches new tokens into MetaDAO-managed liquidity. For some launches we want to restrict where those tokens can flow during an initial period (e.g., 3–9 months): the token should only ever interact with a small set of whitelisted programs (MetaDAO's stack plus DAMM v2 for liquidity), and only specific whitelisted users should be able to initiate operations. After the gating period, the token transitions to a normal, unrestricted SPL Token.

This shapes the program around two simultaneous gates — a **fixed program whitelist** and a **per-mint user whitelist** — and a **tear-down path** that ends gating cleanly.

## 3. Goals

- All transfers / state changes for a gated mint happen only via whitelisted programs invoked through the wrapper.
- Only whitelisted users can initiate wrapper calls for a given mint.
- Gating is tamper-evident: outside the wrapper's atomic execution, all token accounts of the gated mint are frozen.
- Tear-down is a clean, one-way operation: after `disable_gating`, the token behaves like a normal SPL Token (modulo the dormant freeze authority).

## 4. Non-Goals

- General-purpose access control for arbitrary tokens.
- Per-instruction filtering inside whitelisted programs.
- Removing users from the user whitelist (append-only).
- Re-enabling gating after tear-down (one-way).

## 5. Background — Why The Default-Frozen Approach

SPL Token has a `Freeze`/`Thaw` mechanism controlled by the freeze authority. By holding the freeze authority and freezing all accounts, we can make the token statically unusable — and only thaw briefly during atomic, audited operations. This gives us strong static guarantees with minimal on-chain state.

A naïve alternative — using a token program with a "transfer hook" that calls our program — has weaker guarantees: the hook only fires on transfers, and accounts are still in a "live" state otherwise. The freeze approach gives us a clearer invariant: *if you see an unfrozen gated-mint account, something is wrong.*

## 6. High-Level Architecture

```
   whitelisted user ──▶ ┌─────────────────────────────────────────┐
                        │           Gated Token Program           │
                        │   (freeze authority over gated mint)    │
                        │                                         │
                        │  gated_invoke(instruction_data, accs)   │
                        │   ├─ check caller has WhitelistedUser   │
                        │   │    PDA for this mint                │
                        │   ├─ check target_program ∈ hardcoded   │
                        │   │    WHITELISTED_PROGRAMS             │
                        │   ├─ pre-CPI: thaw frozen gated-mint    │
                        │   │    accounts in remaining_accounts   │
                        │   ├─ CPI to target_program              │
                        │   └─ post-CPI: freeze unfrozen          │
                        │       gated-mint accounts in            │
                        │       remaining_accounts (catches new)  │
                        └────────────────┬────────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────┐
                  │      Whitelisted program         │
                  │  (futarchy / launchpad /         │
                  │   conditional_vault / bid_wall / │
                  │   mint_governor / damm_v2)       │
                  └──────────────────────────────────┘
```

## 7. Account Model

The program is **multi-mint**: one deployment serves all gated mints, with per-mint state in PDAs.

The program whitelist is hardcoded as a `const WHITELISTED_PROGRAMS: &[Pubkey]` in the program source — not stored on-chain. The initial whitelist is `futarchy`, `launchpad`, `conditional_vault`, `bid_wall`, `mint_governor`, and `damm_v2`. Adding or removing programs requires a `gated_token` redeploy.

### 7.1 `GatedMintConfig` PDA — per-mint config

One per gated mint. Acts as the **freeze authority** of the underlying mint, and stores the per-mint admin who manages the user whitelist and triggers tear-down.

```rust
#[account]
pub struct GatedMintConfig {
    pub mint: Pubkey,
    pub admin: Pubkey,            // manages user whitelist; can disable gating (one-way)
    pub gating_disabled: bool,    // set true by `disable_gating`; permanent
    pub bump: u8,
}
```

Seeds: `[b"gated_mint_config", mint.as_ref()]`

### 7.2 `WhitelistedUser` PDA — per-(mint, user) entry

Existence of this PDA = the user is on the whitelist for that mint. Created by the mint's `admin`.

```rust
#[account]
pub struct WhitelistedUser {
    pub mint: Pubkey,
    pub user: Pubkey,
    pub bump: u8,
    // optional: added_at, added_by (audit trail)
}
```

Seeds: `[b"whitelisted_user", mint.as_ref(), user.as_ref()]`

This shape:
- **Cheap to check on the hot path** — Anchor account constraint with `seeds`/`bump` validates existence in one step.
- **Cheap to index off-chain** — RPC `getProgramAccounts` filtered on `mint` returns all whitelisted users for that mint.
- **Cost:** rent-exempt minimum per entry (~0.001 SOL). Negligible for 100–1k users.


## 8. Instructions

### 8.1 `initialize_gated_mint` — per-mint setup

Transfers freeze authority from the current authority (a wallet or signer of the caller's choosing) to the `gated_mint_config` PDA, and creates the `GatedMintConfig` account. The current freeze authority signs the call, providing on-chain permission to initiate gating for this mint.

```
Args: (none)
Accounts:
  - payer: Signer
  - mint: Mint (mut)
  - current_freeze_authority: Signer (must equal mint.freeze_authority)
  - gated_mint_config: PDA (init; seeds = [b"gated_mint_config", mint])
  - admin: AccountInfo (stored on GatedMintConfig)
  - token_program
  - system_program
```

The instruction:
1. Verifies the signer matches `mint.freeze_authority`.
2. CPIs `spl_token::set_authority` to transfer freeze authority from the signer to the `gated_mint_config` PDA.
3. Creates `GatedMintConfig` with `gating_disabled = false`.

This pattern mirrors `mint_governor::transfer_authority_to_governor` and provides the natural permission gate: only whoever currently controls the freeze authority can set up gating, so there is no front-run window.

### 8.2 `add_whitelisted_user` — admin-only, per-mint

Creates a `WhitelistedUser` PDA for `(mint, user)`. Signed by the mint's `admin`. Errors if `gating_disabled`.

```
Args: (none — user is read from accounts)
Accounts:
  - payer: Signer (admin or anyone)
  - admin: Signer (must equal gated_mint_config.admin)
  - gated_mint_config: PDA (constraint: gating_disabled == false)
  - user: AccountInfo (the user to whitelist; not signed)
  - whitelisted_user: PDA (init)
  - system_program
```

### 8.3 `gated_invoke` — the wrapper

Validates that the target program is on the hardcoded program whitelist **and** that the caller is on the user whitelist for the mint, thaws gated-mint token accounts found in `remaining_accounts`, CPIs to the target, and refreezes. Errors if `gating_disabled`.

```
Args:
  - instruction_data: Vec<u8>
Accounts:
  - caller: Signer (must have a corresponding WhitelistedUser PDA for `mint`)
  - gated_mint_config: PDA (acts as freeze authority via PDA signing; constraint: gating_disabled == false)
  - whitelisted_user: PDA (constraint: seeds = [b"whitelisted_user", mint, caller])
  - mint: Mint (the gated mint)
  - target_program: AccountInfo (validated against hardcoded WHITELISTED_PROGRAMS)
  - token_program: AccountInfo
  - remaining_accounts: forwarded verbatim to the target CPI
```

**The wrapper makes no assumptions about the inner instruction's account layout.** It only validates `caller` against the user whitelist; it does not manipulate, prepend to, or reorder `remaining_accounts`. If the inner instruction expects the caller as one of its signers (most do — for transferring from the caller's ATA, etc.), the client must include `caller`'s pubkey in `remaining_accounts` at the position the inner instruction expects. The signer flag propagates from the outer transaction to the inner CPI naturally.

The wrapper's only added authority is the freeze-authority PDA signing for thaw/freeze. **The wrapper does NOT add itself as a signer to the inner CPI.**

### 8.4 `disable_gating` — one-way tear-down trigger

Admin sets `gating_disabled = true`, permanently. After this, `gated_invoke` and `add_whitelisted_user` are dead, and `thaw_account` (8.5) becomes permissionless.

```
Args: (none)
Accounts:
  - admin: Signer (must equal gated_mint_config.admin)
  - gated_mint_config: PDA (mut; constraint: gating_disabled == false)
```

### 8.5 `thaw_account` — permissionless after tear-down

Thaws a single gated-mint token account. **Only callable when `gating_disabled == true`.** Anyone can call.

```
Args: (none)
Accounts:
  - gated_mint_config: PDA (signs the thaw via PDA seeds; constraint: gating_disabled == true)
  - mint: Mint
  - token_account: AccountInfo (must be a token account of `mint`)
  - token_program: Program
```

## 9. Invocation Flow Detail

The wrapper does no bookkeeping between phases. Both the pre-CPI thaw pass and the post-CPI freeze pass iterate `remaining_accounts` from scratch and act on each entry inline. Newly-created accounts only become identifiable as gated-mint token accounts at the end of the inner CPI, so any pre-built list would necessarily miss them. Aliased duplicates are handled naturally — the second occurrence sees the account already in the target state and skips.

The per-account check is a cheap raw-bytes inspection (no Anchor deserialization): the account is a gated-mint token account iff `owner == spl_token::ID`, `data.len() == 165`, and bytes `[0..32]` of `data` equal the gated mint. Freeze state is the byte at offset 108 (`Uninitialized=0`, `Initialized=1`, `Frozen=2`).

### 9.0 Pre-flight checks (Anchor constraints)

Before any state changes:
- `target_program.key()` is in the hardcoded `WHITELISTED_PROGRAMS` const.
- `gated_mint_config.gating_disabled == false`.
- `whitelisted_user` PDA exists for `(mint, caller)` — i.e., the signer is allowed to use this mint. Anchor's `seeds`/`bump` constraint handles this with one line.
- `gated_mint_config.mint == mint`.

### 9.1 Pre-CPI thaw pass

Iterate `remaining_accounts`. For each entry:
- Skip unless it passes the per-account check (gated-mint token account).
- Skip unless its state byte is `Frozen`.
- CPI `ThawAccount` signed by the `gated_mint_config` PDA.

### 9.2 Inner CPI

`invoke` (not `invoke_signed`) the target program with the supplied `instruction_data`. Forward `remaining_accounts` directly. The user's signatures from the outer transaction propagate naturally; the program contributes none.

### 9.3 Post-CPI freeze pass

Iterate `remaining_accounts` again. For each entry:
- Skip unless it passes the per-account check. (An entry that didn't pass pre-CPI may pass now — the inner CPI may have initialized it as a gated-mint token account.)
- Skip unless its state byte is `Initialized` (i.e., currently unfrozen).
- CPI `FreezeAccount` signed by the `gated_mint_config` PDA.

This catches three cases without any phase-to-phase state: (a) accounts thawed by us pre-CPI and used by the inner CPI; (b) dangling unfrozen ATAs that pre-existed and were unmodified by the inner CPI; (c) brand-new gated-mint accounts initialized during the inner CPI. All three end frozen.

## 10. New Account Default State

A freshly initialized SPL Token account is **unfrozen by default**. If a user creates a new ATA for the gated mint outside the wrapper, that account is unfrozen until something explicitly freezes it. During that window, tokens minted or transferred to it would be unrestricted.

This is acceptable because no flow can land tokens in such an account without going through the wrapper, *provided* mint authority is held by a program (`mint_governor`) that itself only mints in controlled flows. The threat model:

- **Transfers** require an unfrozen source. All sources are frozen and only the wrapper can thaw, so a transfer to a dangling unfrozen ATA can only happen via the wrapper — and the post-CPI freeze rescan catches the destination.
- **`mint_to`** is gated by `mint_governor`'s authorized_minter mechanism. As long as the authorized minters are program-controlled — either pure program PDAs (e.g., `performance_package_v2`) or Squads-multisig PDAs whose only member is a controlling program (e.g., the DAO Squads vault, whose sole member is the futarchy program executing passed proposals) — dangling-ATA mints can only happen if the controlling program permits them, which it shouldn't.

## 11. Lifecycle / Tear-down

The gating window for a given mint is expected to last ~3–9 months. After that, the mint should become a **regular SPL Token** with no special restrictions.

The tear-down model: **admin disables the wrapper and unlocks permissionless thaw.** Specifically:

1. Per-mint admin calls `disable_gating()`, which sets `gating_disabled = true` on `GatedMintConfig`.
2. After that:
   - `gated_invoke` returns an error.
   - `add_whitelisted_user` returns an error (no point adding users to a dead whitelist).
   - **`thaw_account(account)` becomes permissionless** — anyone can call it to thaw any gated-mint token account.
3. Users thaw their own accounts on demand as they want to use the (now-unrestricted) token. Once thawed, accounts stay thawed (the wrapper is dead and no other code path freezes).
4. Freeze authority remains on `gated_mint_config` PDA permanently but is never exercised. **No re-enable path.**

Cosmetic loose end: external tools that inspect `mint.freezeAuthority` will see a non-null value (the dormant PDA). Nothing material can act on it.

Failed launches (where the mint never gets distributed) need no special handling — the `GatedMintConfig` just sits dormant indefinitely.

## 12. Integration Pattern: Vault-Holding Whitelisted Programs

Some whitelisted programs hold long-lived gated-mint token accounts — vaults, reserves, escrows. The launchpad holds a per-launch base vault; DAMM v2 holds pool reserves; the conditional vault holds a per-vault underlying-token account. For the gating invariant to hold across these programs, those long-lived accounts must be **frozen at rest**. Otherwise an attacker can call the program directly (outside the wrapper) and pull tokens out: the source-side freeze check is what blocks such direct calls.

The pattern that achieves frozen-at-rest:

1. The instruction that creates the vault/reserve is invoked via `gated_invoke`. The post-CPI freeze pass finds the freshly-initialized account as a gated-mint token account and freezes it.
2. Every subsequent operation that touches the vault is also invoked via `gated_invoke`. The wrapper thaws before the inner CPI and refreezes after.
3. A direct call to the program — bypassing the wrapper — finds the vault frozen and fails at the SPL Token source-side state check. No special "is wrapper active?" branch is needed in the inner program; the freeze authority alone is sufficient.

### 12.1 Launchpad v8

A launch is recognized as gated by `base_mint.freeze_authority`: `None` for classic launches, `Some(<expected gated_mint_config PDA>)` for gated launches, anything else rejected at `initialize_launch`. This freeze-authority discriminator is the only launchpad code change required — there is no `is_gated` flag on `Launch`.

Four launchpad instructions must be invoked through `gated_invoke` for gated launches: `initialize_launch`, `settle_launch`, `claim`, and `claim_additional_token_allocation`. The remaining instructions (`start_launch`, `fund`, `set_funding_record_approval`, `close_launch`, `extend_launch`, `refund`, `finalize_launch`) don't touch gated-mint tokens and are called directly — `refund` only moves USDC, `finalize_launch` only manages mint-authority delegation via `mint_governor`.

Gated launches are not compatible with bid walls. The launching team's token allocation is delivered via `mint_governor` (authorized minters added at `finalize_launch`: `performance_package_v2` and the DAO Squads vault), not via launchpad claim.

See `vibes/launchpad-v8-gating-integration-plan.md` for the full lifecycle.

### 12.2 DAMM v2

Pool reserves (the `token_a_vault` for the gated side) follow the same pattern: first liquidity-add through `gated_invoke` freezes the new reserve, subsequent swaps and liquidity-removals are wrappered, direct DAMM v2 calls fail at the source-side freeze check.

### 12.3 Conditional Vault

Each conditional vault holds a `vault_underlying_token_account` that backs all conditional (pass/fail) tokens minted from a given underlying mint. For gated mints, four conditional-vault instructions must be invoked through `gated_invoke`:

- `initialize_conditional_vault` — creates the `vault_underlying_token_account`; the post-CPI freeze pass freezes it.
- `split_tokens` — transfers underlying from user to vault (both gated-mint accounts).
- `merge_tokens` — transfers underlying from vault to user.
- `redeem_tokens` — same as merge but post-resolution.

The other conditional-vault instructions (`initialize_question`, `add_metadata_to_conditional_tokens`, `resolve_question`) don't touch gated-mint accounts and stay direct.

The pass/fail mints themselves have no freeze authority and are freely transferable, but they have no exit value to non-whitelisted holders — the only way to convert them back to underlying is via `merge_tokens` or `redeem_tokens`, both of which require passing the wrapper's user-whitelist check. The set of accounts that can ultimately hold the underlying gated mint is therefore unchanged by conditional-vault wrapping.

### 12.4 Ordering requirement

A gated mint's `GatedMintConfig` must be initialized — and the mint's freeze authority must be the corresponding PDA — before any vault for that mint is created. If the order is reversed, the vault is initialized when no freeze enforcement applies and tokens leak.

### 12.5 CPI depth

The wrapped `settle_launch` chain (`gated_token → launchpad → futarchy → squads → spl_token`) reaches 5 programs simultaneously, the default Solana stack-depth limit. `settle_launch` is the only instruction in this integration that operates that close to the limit; any change that adds a nested CPI inside its call graph needs to be reviewed against this constraint.

## 13. Security Considerations

- **Reentrancy.** The Solana runtime forbids a program from appearing twice in a CPI stack. If a whitelisted program needs to CPI back into the gated token program, that call fails. This constrains the whitelist (we likely can't whitelist a program that internally wants to do `gated_invoke` itself).
- **Privilege escalation.** The wrapper must NOT mark itself as signer on the inner CPI beyond the freeze-authority PDA. Inadvertently signing as the user would be catastrophic.
- **Account aliasing.** Duplicate accounts in `remaining_accounts` are handled implicitly by the state-before-action checks in §9 — once the first occurrence has thawed (or frozen) the account, subsequent occurrences see it already in the target state and skip. No explicit dedup pass is needed.
- **Mint mismatch / spoofing.** Always verify the mint field at the byte level — don't trust an attacker-provided account claiming to be a gated-mint token account.
- **Program upgrade authority compromise.** Since the program whitelist is hardcoded, a compromised upgrade authority can deploy a malicious version of `gated_token` that whitelists arbitrary programs (or removes gating entirely). Mitigate with a Squads-controlled upgrade authority. After tear-down, this risk also applies to whether the dormant freeze authority could be re-activated by a malicious upgrade — though by then the token is unrestricted anyway.
- **Per-mint admin compromise.** A compromised admin can (a) add arbitrary users to the user whitelist, allowing them to invoke wrapper calls; (b) call `disable_gating` to permanently end gating. Both are recoverable in spirit (the freeze invariant for token movement still holds; gating just becomes broader / shorter than intended), but (b) is irreversible. Recommend the per-mint admin be a Squads multisig.
- **`mint_governor` authorized minter must be program-controlled.** Acceptable shapes: a pure program PDA (e.g., `performance_package_v2`), or a Squads-multisig PDA whose sole member is a controlling program (e.g., the DAO Squads vault, whose only member is the futarchy program executing passed proposals). A wallet-controlled or open-multisig authorized minter could mint into a dangling unfrozen ATA, bypassing gating. This is a configuration-time discipline, not enforced on-chain by `gated_token`.
