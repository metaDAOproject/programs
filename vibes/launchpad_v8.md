# Launchpad v8 Design Document

## Overview

Launchpad v8 is the next iteration of the launch program. The two key architectural changes are:

1. **Mint Governor integration** — instead of transferring raw mint authority to the DAO on completion, the launchpad sets up a `MintGovernor` that provides structured, delegated minting
2. **Performance Package v2** — instead of pre-minting team tokens into a locked vault, tokens are minted on demand via `mint_governor` when milestones are achieved

These changes shift the token model from **fixed supply at launch** to **structured dilution over time**, giving the DAO fine-grained control over who can mint and how much.

---

## What Changes from v7

### v7 Token Flow (current)

```
initialize_launch:
  mint ALL tokens upfront →
    participants (10M) + futarchy_liq (2M) + damm_liq (900K)
    + performance_package + additional_tokens

settle_launch (v7: complete_launch):
  transfer mint authority → squads_multisig_vault (raw, unrestricted)

initialize_performance_package (v7 name):
  CPI → price_based_performance_package (v1)
  tokens already pre-minted, transferred to PP vault
```

### v8 Token Flow (proposed)

```
initialize_launch:
  1. create token metadata (launch_signer is still raw mint authority)
  2. initialize MintGovernor (admin = launch_signer, create_key = launch_signer)
  3. add launch_signer as authorized_minter (max_total = known supply)
  4. transfer mint authority → MintGovernor PDA
  5. create base vault ATA (empty — no tokens minted yet)

  NO MINTING. MintGovernor owns the mint authority from the start.
  launch_signer is admin throughout the launch lifecycle.
  If the launch fails → zero tokens ever exist.

settle_launch:
  1. mint_governor::mint_tokens → base vault (exact amount needed)
     single mint: participants + futarchy_liq + damm_liq + additional_tokens
  2. initialize DAO (same as v7)
  3. provide liquidity (same as v7)
  4. distribute (same as v7)
  (net zero CPI change: mint_tokens replaces the old set_authority call)

finalize_launch:
  1. add PP v2 PDA as authorized_minter in MintGovernor (launch_signer still admin)
  2. initialize performance_package_v2 with oracle_reader + reward_function
  3. transfer MintGovernor admin → squads_multisig_vault (DAO) — final handoff
  tokens minted on demand when milestones hit (via mint_governor CPI)
```

Fallback: if `settle_launch` CPI budget is too tight, move the mint back
to `initialize_launch` (just add a `mint_governor::mint_tokens` call at the end).
Everything else stays the same.

---

## Architectural Decisions

### Why MintGovernor instead of raw mint authority?

In v7, `settle_launch` (then called `complete_launch`) transfers raw SPL mint authority to the DAO's squads vault. This means:
- Any squads vault transaction can mint unlimited tokens
- No per-program caps or audit trail at the protocol level
- The only gate is the Squads multisig approval

With MintGovernor:
- The DAO admin (squads vault) controls who can mint via `add_mint_authority` / `remove_mint_authority`
- Each authorized minter can have a `max_total` cap
- All minting goes through `mint_governor::mint_tokens`, providing on-chain accounting (`total_minted`)
- The DAO can still reclaim raw authority via `reclaim_authority` if needed (escape hatch)

### Why Performance Package v2 instead of v1?

v1 (`price_based_performance_package`) pre-mints tokens into a vault. This has drawbacks:
- Tokens exist on day 1, diluting circulating supply accounting
- If milestones are never hit, tokens sit locked forever (but are counted in supply)
- Oracle reads raw bytes at offsets — fragile and tightly coupled to account layout

v2 (`performance_package_v2`) mints on demand:
- Zero supply impact until milestones are actually achieved
- Cleaner oracle model (`OracleReader` enum: `Time`, `FutarchyTwap`)
- Flexible reward functions (`CliffLinear`, `Threshold`)
- The PP PDA acts as an `authorized_minter` in MintGovernor — clean CPI chain

---

## Instruction Changes

### `initialize_launch`

**Changes from v7:**
- Remove `performance_package_token_amount` from mint calculation
- Remove `token::mint_to` — no minting at init time
- Set up MintGovernor infrastructure and transfer mint authority immediately
- Create base vault ATA (empty)
- Still store performance package config in `Launch` state for later use

**New flow:**
1. `create_metadata_accounts_v3` — launch_signer is still the raw mint authority at this point, which metaplex requires
2. `mint_governor::initialize_mint_governor` — create_key = launch_signer, admin = launch_signer
3. `mint_governor::add_mint_authority` — launch_signer as authorized_minter, `max_total` = exact needed supply (`TOKENS_TO_PARTICIPANTS + TOKENS_TO_FUTARCHY_LIQUIDITY + TOKENS_TO_DAMM_V2_LIQUIDITY + additional_tokens_amount`)
4. `mint_governor::transfer_authority_to_governor` — SPL mint authority moves from launch_signer → MintGovernor PDA
5. Create base vault ATA (empty)

After this, the MintGovernor PDA owns mint authority and launch_signer is admin + authorized minter with unused `max_total`. No tokens exist. If the launch fails, none ever will.

**Args changes:**
- Keep `performance_package_grantee`, `months_until_insiders_can_unlock`, `performance_package_token_amount`
- Same args as v7 — the tranche structure (5 tranches at 2x/4x/8x/16x/32x) is derived from these at `finalize_launch` time, just targeting PP v2 instead of v1

**New accounts needed:**
- `mint_governor` — MintGovernor PDA (initialized via CPI)
- `mint_authority` — MintAuthority PDA for launch_signer (initialized via CPI)
- `mint_governor_program` — the MintGovernor program
- `mint_governor_event_authority` — for CPI events

### `settle_launch`

**(v7: `complete_launch`)**

**Changes from v7:**
- Remove `transfer_mint_authority_to_dao()` (`token::set_authority`)
- Add: `mint_governor::mint_tokens` — single mint of exact needed supply into base vault
- Net zero CPI change: one in, one out
- Everything else stays the same (DAO init, liquidity, Meteora, bid wall, etc.)

The mint happens at the top of the handler, before any distribution. At this point
we know `total_approved_amount` and can compute exact allocations. The base vault
ATA already exists (created during `initialize_launch`, just empty).

**Net account impact:** Roughly neutral. We swap `base_mint` authority accounts
for `mint_governor` + `mint_authority` + `mint_governor_program` accounts.

**New accounts needed:**
- `mint_governor` — the MintGovernor PDA (already exists from init)
- `mint_authority` — the MintAuthority PDA for launch_signer (already exists from init)
- `mint_governor_program` — for the mint CPI
- `mint_governor_event_authority` — for CPI events

### `finalize_launch`

**Major rewrite — now targets performance_package_v2:**

1. CPI → `mint_governor::add_mint_authority` to register the PP v2 PDA as an authorized minter
   - Requires DAO admin (squads_multisig_vault) as signer → **reentrancy concern**
   - Alternative: the launchpad_signer could be a temporary admin, add the authority, then transfer admin to DAO
2. CPI → `performance_package_v2::initialize_performance_package` with:
   - `oracle_reader`: `FutarchyTwap { amm: dao.key(), min_duration: 3_months }` (same TWAP concept as v7)
   - `reward_function`: `Threshold` with price-based tranches (2x, 4x, 8x, 16x, 32x of launch price)
   - `min_unlock_timestamp`: completion time + lockup months
   - `recipient`: performance_package_grantee from launch config
   - `authority`: squads_multisig_vault (DAO)

**Key difference from v7:** No token transfer. The PP v2 will CPI into mint_governor to mint tokens when milestones are hit.

**Admin transfer happens here — not in `settle_launch`.**
The launch_signer stays MintGovernor admin through `settle_launch` so that
`finalize_launch` can add the PP v2 PDA as an authorized minter
without needing a Squads transaction. The admin transfer to squads_multisig_vault
is the very last operation in the launch lifecycle — after all minting
infrastructure is fully wired up.

### Removed / unchanged instructions

| Instruction | Status |
|---|---|
| `start_launch` | Unchanged |
| `fund` | Unchanged |
| `set_funding_record_approval` | Unchanged |
| `complete_launch` | Renamed → `settle_launch` |
| `claim` | Unchanged |
| `refund` | Unchanged |
| `close_launch` | Unchanged |
| `claim_additional_token_allocation` | Unchanged |
| `extend_launch` | Unchanged |
| `initialize_performance_package` | Renamed → `finalize_launch` |

---

## State Changes

### `Launch` account

**Fields to add:**
- `mint_governor: Pubkey` — set at initialization (not optional — always present in v8)
- Performance package v2 config fields (or keep existing fields and derive v2 config from them)

**Fields to keep:**
- `performance_package_token_amount` — no longer pre-minted, but still used to derive the PP v2 reward function at `finalize_launch` time
- `is_performance_package_initialized` — still needed to gate the instruction

The tranche structure remains hardcoded and opinionated (5 tranches at 2x/4x/8x/16x/32x of launch price), same as v7. The only change is the target program (PP v2 + mint_governor instead of v1 vault).

---

## CPI Chain

```
launchpad_v8::initialize_launch
  ├── mpl_token_metadata::create_metadata_accounts_v3 (launch_signer is raw authority)
  ├── mint_governor::initialize_mint_governor (admin = launch_signer)
  ├── mint_governor::add_mint_authority (launch_signer, max_total = known supply)
  └── mint_governor::transfer_authority_to_governor (mint auth → MintGovernor PDA)
  (base vault ATA created via anchor init_if_needed, empty — no minting)

launchpad_v8::settle_launch
  ├── mint_governor::mint_tokens → base vault (replaces old token::set_authority)
  ├── futarchy::initialize_dao (same as v7)
  ├── futarchy::provide_liquidity (same as v7)
  ├── bid_wall::initialize_bid_wall (same as v7, if configured)
  ├── damm_v2::initialize_pool_with_dynamic_config (same as v7)
  ├── mpl_token_metadata::update_metadata_accounts_v2 (metadata authority → DAO)
  └── token::transfer USDC to DAO treasury (same as v7)

launchpad_v8::finalize_launch (separate tx, post-completion)
  ├── mint_governor::add_mint_authority (PP v2 PDA as authorized_minter)
  ├── performance_package_v2::initialize_performance_package
  └── mint_governor::update_mint_governor_admin → squads_multisig_vault
```

Fallback: if settle_launch CPI budget is too tight, move mint_tokens
back to initialize_launch. Everything else stays the same.

---

## Open Questions

1. (none currently)

### Resolved

- ~~Account pressure on `initialize_launch`~~ — v7 has ~15 accounts and 2 CPIs. v8 adds ~4 accounts and 2 net CPIs (~19 accounts, 4 CPIs total). Well within limits.
- ~~Migration path~~ — fresh program deploy, new program ID.
- ~~`additional_tokens_amount` minting~~ — included in the single `mint_governor::mint_tokens` call in `settle_launch`, part of launch_signer's `max_total`.
- ~~MintGovernor `max_total` for PP v2~~ — set to `performance_package_token_amount`. Deterministic from the hardcoded 5-tranche threshold reward function.
- ~~Metadata authority~~ — unchanged from v7, transferred to DAO via `update_metadata_accounts_v2` in `settle_launch`.

---

## Dependencies

| Program | Role in v8 |
|---|---|
| `futarchy` | DAO initialization, AMM liquidity |
| `squads_multisig` | DAO authority, spending limits |
| `mint_governor` | **NEW** — structured minting authority |
| `performance_package_v2` | **NEW** — milestone-based token rewards |
| `damm_v2_cpi` | Meteora pool creation |
| `bid_wall` | Price floor mechanism |
| `mpl_token_metadata` | Token metadata |
