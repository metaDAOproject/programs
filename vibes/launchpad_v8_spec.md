# Launchpad v8 — Implementation Spec

> **Reference:** `vibes/launchpad_v8.md` for architectural rationale and design decisions.

---

## Summary of Changes from v7

| Area | v7 | v8 |
|------|----|----|
| Token minting | All tokens minted upfront in `initialize_launch` | No minting at init; tokens minted on demand |
| Mint authority | Raw SPL authority transferred to DAO in `complete_launch` | MintGovernor PDA owns authority from init; admin transferred to DAO in `finalize_launch` |
| Performance package | v1 (pre-minted vault) | v2 (mint-on-demand via MintGovernor) |
| `complete_launch` | Transfers mint authority to DAO | Renamed → `settle_launch`; mints tokens via MintGovernor |
| `initialize_performance_package` | Initializes PP v1 with pre-minted tokens | Renamed → `finalize_launch`; initializes PP v2 + transfers MintGovernor admin |
| Migration instructions | `resize_launch`, `resize_funding_record` | Removed (fresh deploy, new program ID) |
| Program ID | `moontUzsdepotRGe5xsfip7vLPTJnVuafqdUWexVnPM` | `MooNv7KbVWxQPCbCALJquw4D9pnVF7n8Nh2HmGqsxjg` |

---

## Constants

```rust
pub const TOKEN_SCALE: u64 = 1_000_000;
pub const PRICE_SCALE: u128 = 1_000_000_000_000;
pub const TOKENS_TO_PARTICIPANTS: u64 = 10_000_000 * TOKEN_SCALE;
pub const TOKENS_TO_FUTARCHY_LIQUIDITY: u64 = 2_000_000 * TOKEN_SCALE;
pub const TOKENS_TO_DAMM_V2_LIQUIDITY: u64 = TOKENS_TO_DAMM_V2_LIQUIDITY_UNSCALED * TOKEN_SCALE;
pub const TOKENS_TO_DAMM_V2_LIQUIDITY_UNSCALED: u64 = 900_000;
pub const PROPOSAL_MIN_STAKE_TOKENS: u64 = 1_500_000 * TOKEN_SCALE;

// PP v2 tranche config
pub const PP_NUM_TRANCHES: usize = 5;
pub const PP_PRICE_MULTIPLIERS: [u128; 5] = [2, 4, 8, 16, 32];

// FutarchyTwap min_duration: 3 months
pub const PP_TWAP_MIN_DURATION: u32 = 3 * 30 * 24 * 60 * 60; // 7_776_000 seconds
```

All unchanged from v7 except PP constants (new).

---

## State

### `LaunchState` (unchanged)

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum LaunchState {
    Initialized,
    Live,
    Closed,
    Complete,
    Refunding,
}
```

### `Launch` account

Seeds: `[b"launch", base_mint.key()]`

```rust
#[account]
pub struct Launch {
    // -- Unchanged fields --
    pub pda_bump: u8,
    pub minimum_raise_amount: u64,
    pub monthly_spending_limit_amount: u64,
    pub monthly_spending_limit_members: Vec<Pubkey>,    // max 10
    pub launch_authority: Pubkey,
    pub launch_signer: Pubkey,
    pub launch_signer_pda_bump: u8,
    pub launch_quote_vault: Pubkey,
    pub launch_base_vault: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub unix_timestamp_started: Option<i64>,
    pub unix_timestamp_closed: Option<i64>,
    pub total_committed_amount: u64,
    pub state: LaunchState,
    pub seq_num: u64,
    pub seconds_for_launch: u32,
    pub dao: Option<Pubkey>,
    pub dao_vault: Option<Pubkey>,
    pub performance_package_grantee: Pubkey,
    pub performance_package_token_amount: u64,
    pub months_until_insiders_can_unlock: u8,
    pub team_address: Pubkey,
    pub total_approved_amount: u64,
    pub additional_tokens_amount: u64,
    pub additional_tokens_recipient: Option<Pubkey>,
    pub additional_tokens_claimed: bool,
    pub unix_timestamp_completed: Option<i64>,
    pub is_performance_package_initialized: bool,
    pub accumulator_activation_delay_seconds: u32,
    pub has_bid_wall: bool,

    // -- New field --
    pub mint_governor: Pubkey,                          // Set at initialization
}
```

### `FundingRecord` account (unchanged)

Seeds: `[b"funding_record", launch.key(), funder.key()]`

```rust
#[account]
pub struct FundingRecord {
    pub pda_bump: u8,
    pub funder: Pubkey,
    pub launch: Pubkey,
    pub committed_amount: u64,
    pub is_tokens_claimed: bool,
    pub is_usdc_refunded: bool,
    pub approved_amount: u64,
    pub committed_amount_accumulator: u128,
    pub last_accumulator_update: i64,
}
```

### `launch_signer` PDA (unchanged)

Seeds: `[b"launch_signer", launch.key()]`

Unchanged PDA used as the signing authority for the launch program.

---

## Instructions

### 1. `initialize_launch` — CHANGED

**Changes from v7:**
- Remove `token::mint_to` — no tokens minted at init
- Add MintGovernor setup: init governor, add launch_signer as minter, transfer mint authority
- Store `mint_governor` pubkey in Launch state

#### Args

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeLaunchArgs {
    pub minimum_raise_amount: u64,
    pub monthly_spending_limit_amount: u64,
    pub monthly_spending_limit_members: Vec<Pubkey>,
    pub seconds_for_launch: u32,
    pub token_name: String,
    pub token_symbol: String,
    pub token_uri: String,
    pub performance_package_grantee: Pubkey,
    pub performance_package_token_amount: u64,
    pub months_until_insiders_can_unlock: u8,
    pub team_address: Pubkey,
    pub additional_tokens_amount: u64,
    pub accumulator_activation_delay_seconds: u32,
    pub has_bid_wall: bool,
}
```

Unchanged from v7.

#### Accounts

```rust
#[derive(Accounts)]
#[instruction(args: InitializeLaunchArgs)]
pub struct InitializeLaunch<'info> {
    // -- Same as v7 --
    #[account(init, payer = payer, space = 8 + Launch::INIT_SPACE,
        seeds = [b"launch", base_mint.key().as_ref()], bump)]
    pub launch: Account<'info, Launch>,

    #[account(mut, mint::decimals = 6, mint::authority = launch_signer)]
    pub base_mint: Account<'info, Mint>,

    #[account(mut, seeds = [b"metadata", MPL_TOKEN_METADATA_PROGRAM_ID.as_ref(),
        base_mint.key().as_ref()], seeds::program = MPL_TOKEN_METADATA_PROGRAM_ID, bump)]
    pub token_metadata: UncheckedAccount<'info>,

    #[account(seeds = [b"launch_signer", launch.key().as_ref()], bump)]
    pub launch_signer: UncheckedAccount<'info>,

    #[account(init_if_needed, payer = payer, associated_token::mint = quote_mint,
        associated_token::authority = launch_signer)]
    pub quote_vault: Account<'info, TokenAccount>,

    #[account(init_if_needed, payer = payer, associated_token::mint = base_mint,
        associated_token::authority = launch_signer)]
    pub base_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub launch_authority: UncheckedAccount<'info>,

    #[account(mint::decimals = 6, address = usdc_mint::id())]
    pub quote_mint: Account<'info, Mint>,

    pub additional_tokens_recipient: Option<UncheckedAccount<'info>>,

    // -- New: MintGovernor accounts --
    /// PDA: seeds = [b"mint_governor", base_mint, launch_signer (create_key)]
    /// Initialized via CPI to mint_governor::initialize_mint_governor
    #[account(mut)]
    pub mint_governor: UncheckedAccount<'info>,

    /// PDA: seeds = [b"mint_authority", mint_governor, launch_signer (authorized_minter)]
    /// Initialized via CPI to mint_governor::add_mint_authority
    #[account(mut)]
    pub mint_authority: UncheckedAccount<'info>,

    pub mint_governor_program: Program<'info, MintGovernorProgram>,
    pub mint_governor_event_authority: UncheckedAccount<'info>,

    // -- Standard --
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub token_metadata_program: Program<'info, Metadata>,
}
```

#### Validation

Same as v7:
- `minimum_raise_amount > 0`
- `seconds_for_launch <= 14 days`
- `accumulator_activation_delay_seconds < seconds_for_launch`
- No freeze authority on `base_mint`
- `minimum_raise_amount >= monthly_spending_limit_amount * 6`
- `minimum_raise_amount >= futarchy::MIN_QUOTE_LIQUIDITY * 5`
- `monthly_spending_limit_amount != 0`
- `monthly_spending_limit_members.len()` in `1..=10`, no duplicates
- `months_until_insiders_can_unlock >= 12`
- `performance_package_token_amount >= 10`
- `base_mint.supply == 0`
- If `additional_tokens_amount > 0`, `additional_tokens_recipient` must be `Some`

#### Handler

```
1. Initialize Launch account (state = Initialized, store all fields including mint_governor key)

2. CPI → mpl_token_metadata::create_metadata_accounts_v3
   - mint_authority = launch_signer (still raw SPL authority at this point)
   - update_authority = launch_signer

3. CPI → mint_governor::initialize_mint_governor
   - create_key = launch_signer
   - admin = launch_signer
   - mint = base_mint

4. CPI → mint_governor::add_mint_authority
   - admin = launch_signer
   - authorized_minter = launch_signer
   - max_total = Some(TOKENS_TO_PARTICIPANTS + TOKENS_TO_FUTARCHY_LIQUIDITY
                      + TOKENS_TO_DAMM_V2_LIQUIDITY + additional_tokens_amount)

5. CPI → mint_governor::transfer_authority_to_governor
   - current_authority = launch_signer
   - mint = base_mint
   → SPL mint authority moves from launch_signer → MintGovernor PDA

6. NO token::mint_to (removed from v7)

7. Emit LaunchInitializedEvent
```

After this instruction:
- MintGovernor PDA owns the SPL mint authority
- launch_signer is admin + authorized minter with a capped `max_total`
- Zero tokens exist
- base_vault ATA exists but is empty

---

### 2. `start_launch` — UNCHANGED

```rust
#[derive(Accounts)]
pub struct StartLaunch<'info> {
    #[account(mut, has_one = launch_authority)]
    pub launch: Account<'info, Launch>,
    pub launch_authority: Signer<'info>,
}
```

Sets state `Initialized → Live`, records `unix_timestamp_started`.

---

### 3. `fund` — UNCHANGED

```rust
#[derive(Accounts)]
pub struct Fund<'info> {
    #[account(mut, has_one = launch_quote_vault)]
    pub launch: Account<'info, Launch>,
    #[account(init_if_needed, payer = payer, space = 8 + FundingRecord::INIT_SPACE,
        seeds = [b"funding_record", launch.key().as_ref(), funder.key().as_ref()], bump)]
    pub funding_record: Account<'info, FundingRecord>,
    #[account(mut)]
    pub launch_quote_vault: Account<'info, TokenAccount>,
    pub funder: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, associated_token::mint = launch.quote_mint, associated_token::authority = funder)]
    pub funder_quote_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
```

Transfers quote tokens from funder to vault. Updates accumulator. Emits `LaunchFundedEvent`.

---

### 4. `set_funding_record_approval` — UNCHANGED

```rust
#[derive(Accounts)]
pub struct SetFundingRecordApproval<'info> {
    #[account(mut, has_one = launch_authority)]
    pub launch: Account<'info, Launch>,
    #[account(mut, has_one = launch)]
    pub funding_record: Account<'info, FundingRecord>,
    pub launch_authority: Signer<'info>,
}
```

Sets `approved_amount` on a funding record. Only callable while `Closed` and within 2 days of close.

---

### 5. `close_launch` — UNCHANGED

```rust
#[derive(Accounts)]
pub struct CloseLaunch<'info> {
    #[account(mut)]
    pub launch: Account<'info, Launch>,
}
```

Transitions `Live → Closed` (or `→ Refunding` if below minimum).

---

### 6. `settle_launch` — CHANGED (renamed from `complete_launch`)

**Changes from v7:**
- Renamed from `complete_launch`
- Remove `token::set_authority` (transfer mint authority to DAO) — MintGovernor admin stays as launch_signer
- Add `mint_governor::mint_tokens` — single mint of exact needed supply into base vault
- Everything else (DAO init, liquidity, Meteora, bid wall, metadata transfer, USDC transfer) stays the same

> **Note:** The old `token::set_authority` was a direct CPI (depth 2). The new `mint_governor::mint_tokens` is depth 3 (launchpad → mint_governor → token::mint_to). Still well within the depth-4 limit.

#### Accounts

```rust
#[derive(Accounts)]
pub struct SettleLaunch<'info> {
    // -- Same as v7 complete_launch --
    #[account(mut, has_one = launch_quote_vault, has_one = launch_base_vault,
        has_one = launch_signer, has_one = base_mint, has_one = quote_mint,
        has_one = mint_governor)]
    pub launch: Box<Account<'info, Launch>>,

    pub launch_authority: Option<Signer<'info>>,

    #[account(mut, seeds = [b"metadata", MPL_TOKEN_METADATA_PROGRAM_ID.as_ref(),
        base_mint.key().as_ref()], seeds::program = MPL_TOKEN_METADATA_PROGRAM_ID, bump)]
    pub token_metadata: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub launch_signer: UncheckedAccount<'info>,

    #[account(mut, associated_token::mint = quote_mint, associated_token::authority = launch_signer)]
    pub launch_quote_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut, associated_token::mint = base_mint, associated_token::authority = launch_signer)]
    pub launch_base_vault: Box<Account<'info, TokenAccount>>,

    #[account(init_if_needed, payer = payer, associated_token::mint = quote_mint,
        associated_token::authority = squads_multisig_vault)]
    pub treasury_quote_account: Box<Account<'info, TokenAccount>>,

    #[account(mut, address = meteora_accounts.base_mint.key())]
    pub base_mint: Box<Account<'info, Mint>>,

    #[account(address = meteora_accounts.quote_mint.key())]
    pub quote_mint: Box<Account<'info, Mint>>,

    // DAO / Squads accounts (same as v7)
    #[account(mut)]
    pub dao: UncheckedAccount<'info>,
    #[account(mut)]
    pub squads_multisig: UncheckedAccount<'info>,
    pub squads_multisig_vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub spending_limit: UncheckedAccount<'info>,

    // Futarchy AMM (same as v7)
    #[account(mut)]
    pub dao_owned_lp_position: UncheckedAccount<'info>,
    #[account(mut)]
    pub futarchy_amm_base_vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub futarchy_amm_quote_vault: UncheckedAccount<'info>,

    // Bid wall (same as v7)
    #[account(mut)]
    pub bid_wall: UncheckedAccount<'info>,
    #[account(mut)]
    pub bid_wall_quote_token_account: UncheckedAccount<'info>,

    pub fee_recipient: AccountInfo<'info>,

    // -- New: MintGovernor accounts --
    #[account(mut)]
    pub mint_governor: Account<'info, MintGovernor>,

    #[account(mut, has_one = mint_governor,
        constraint = mint_authority.authorized_minter == launch_signer.key()
            @ LaunchpadError::InvalidMintAuthority)]
    pub mint_authority: Account<'info, MintAuthority>,

    pub mint_governor_program: Program<'info, MintGovernorProgram>,
    pub mint_governor_event_authority: UncheckedAccount<'info>,

    // Standard + nested (same as v7)
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub static_accounts: StaticCompleteLaunchAccounts<'info>,
    pub meteora_accounts: MeteoraAccounts<'info>,
}
```

`StaticCompleteLaunchAccounts` and `MeteoraAccounts` — same as v7.

#### Validation

Same as v7:
- Launch state must be `Closed`
- If within 2 days of close → `launch_authority` must be present and match
- If `launch_authority` signs → `total_approved_amount >= minimum_raise_amount`

#### Handler

```
1. If total_approved_amount < minimum_raise_amount → set state to Refunding, return early

2. (NEW) CPI → mint_governor::mint_tokens
   - authorized_minter = launch_signer (signs via PDA seeds)
   - destination_ata = launch_base_vault
   - amount = TOKENS_TO_PARTICIPANTS + TOKENS_TO_FUTARCHY_LIQUIDITY
              + TOKENS_TO_DAMM_V2_LIQUIDITY + additional_tokens_amount

3. Calculate launch_price = (total_approved_amount * PRICE_SCALE) / TOKENS_TO_PARTICIPANTS

4. Allocate USDC: 20% to futarchy AMM, remainder to DAO (minus optional bid wall)

5. CPI → futarchy::initialize_dao (same as v7)

6. If has_bid_wall → CPI → bid_wall::initialize_bid_wall (same as v7)

7. CPI → futarchy::provide_liquidity (same as v7)

8. CPI → damm_v2::initialize_pool_with_dynamic_config (same as v7)

9. CPI → mpl_token_metadata::update_metadata_accounts_v2
   - Transfer metadata update_authority from launch_signer → squads_multisig_vault

10. Transfer USDC from launch_quote_vault → treasury_quote_account (same as v7)

11. (REMOVED) token::set_authority — no longer transferring raw mint authority

12. Set state = Complete, unix_timestamp_completed, dao, dao_vault
13. Emit LaunchSettledEvent
```

**Key difference:** MintGovernor admin remains as `launch_signer` after this instruction. The admin transfer to the DAO happens in `finalize_launch`.

---

### 7. `finalize_launch` — CHANGED (renamed from `initialize_performance_package`)

**Complete rewrite — now targets PP v2 + MintGovernor admin transfer.**

#### Accounts

```rust
#[derive(Accounts)]
pub struct FinalizeLaunch<'info> {
    #[account(mut, has_one = launch_signer, has_one = base_mint, has_one = mint_governor,
        has_one = performance_package_grantee,
        constraint = launch.dao == Some(dao.key()) @ LaunchpadError::InvalidDao)]
    pub launch: Box<Account<'info, Launch>>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub launch_signer: UncheckedAccount<'info>,

    #[account(address = launch.base_mint)]
    pub base_mint: Account<'info, Mint>,

    // DAO / Squads
    pub dao: UncheckedAccount<'info>,

    // NOTE: seeds::program = squads_program is required here because these are
    // cross-program PDAs derived from the Squads program, not the launchpad.
    #[account(seeds = [squads_multisig_program::SEED_PREFIX,
        squads_multisig_program::SEED_MULTISIG, dao.key().as_ref()],
        seeds::program = squads_program, bump)]
    pub squads_multisig: UncheckedAccount<'info>,

    #[account(seeds = [squads_multisig_program::SEED_PREFIX, squads_multisig.key().as_ref(),
        squads_multisig_program::SEED_VAULT, 0_u8.to_le_bytes().as_ref()],
        seeds::program = squads_program, bump)]
    pub squads_multisig_vault: UncheckedAccount<'info>,

    /// The performance package grantee — stored in launch state, passed here
    /// for the PP v2 initialize CPI (recipient field).
    pub performance_package_grantee: UncheckedAccount<'info>,

    // MintGovernor
    #[account(mut)]
    pub mint_governor: Account<'info, MintGovernor>,

    /// MintAuthority for PP v2 PDA — initialized via CPI
    /// PDA: seeds = [b"mint_authority", mint_governor, performance_package]
    #[account(mut)]
    pub pp_mint_authority: UncheckedAccount<'info>,

    // Performance Package v2
    /// PP v2 account — initialized via CPI
    /// PDA: seeds = [b"performance_package", launch_signer (create_key)]
    #[account(mut)]
    pub performance_package: UncheckedAccount<'info>,

    // Programs
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub squads_program: Program<'info, SquadsMultisig>,
    pub mint_governor_program: Program<'info, MintGovernorProgram>,
    pub mint_governor_event_authority: UncheckedAccount<'info>,
    pub performance_package_v2_program: Program<'info, PerformancePackageV2Program>,
    pub performance_package_v2_event_authority: UncheckedAccount<'info>,
}
```

#### Validation

```rust
fn validate(&self) -> Result<()> {
    require!(self.launch.state == LaunchState::Complete, LaunchpadError::InvalidLaunchState);
    require!(!self.launch.is_performance_package_initialized,
        LaunchpadError::PerformancePackageAlreadyInitialized);
    Ok(())
}
```

#### Handler

```
1. Compute launch_price = (total_approved_amount * PRICE_SCALE) / TOKENS_TO_PARTICIPANTS

2. Build threshold tranches for PP v2:
   tranches = [
     { threshold: launch_price * 2,  cumulative_amount: pp_token_amount * 1 / 5 },
     { threshold: launch_price * 4,  cumulative_amount: pp_token_amount * 2 / 5 },
     { threshold: launch_price * 8,  cumulative_amount: pp_token_amount * 3 / 5 },
     { threshold: launch_price * 16, cumulative_amount: pp_token_amount * 4 / 5 },
     { threshold: launch_price * 32, cumulative_amount: pp_token_amount },
   ]

3. CPI → mint_governor::add_mint_authority
   - admin = launch_signer (still admin at this point)
   - authorized_minter = performance_package PDA
   - max_total = Some(performance_package_token_amount)

4. CPI → performance_package_v2::initialize_performance_package
   - create_key = launch_signer
   - mint = base_mint
   - mint_governor = launch.mint_governor
   - mint_authority = pp_mint_authority (created in step 3)
   - authority = squads_multisig_vault (DAO controls the PP)
   - recipient = launch.performance_package_grantee
   - args = InitializePerformancePackageArgs {
       oracle_reader: FutarchyTwap { amm: dao.key(), min_duration: PP_TWAP_MIN_DURATION },
       reward_function: Threshold { tranches },
       min_unlock_timestamp: unix_timestamp_completed
           + (months_until_insiders_can_unlock as i64) * 30 * 24 * 60 * 60,
     }

5. CPI → mint_governor::update_mint_governor_admin
   - admin = launch_signer
   - new_admin = squads_multisig_vault
   → Final handoff: DAO now controls MintGovernor

6. Set is_performance_package_initialized = true
7. Emit LaunchFinalizedEvent
```

---

### 8. `claim` — UNCHANGED

```rust
#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut, has_one = launch_signer, has_one = base_mint, has_one = launch_base_vault)]
    pub launch: Account<'info, Launch>,
    #[account(mut, has_one = launch, has_one = funder)]
    pub funding_record: Account<'info, FundingRecord>,
    pub launch_signer: UncheckedAccount<'info>,
    pub base_mint: Account<'info, Mint>,
    #[account(mut)]
    pub launch_base_vault: Account<'info, TokenAccount>,
    pub funder: UncheckedAccount<'info>,
    #[account(mut, associated_token::mint = base_mint, associated_token::authority = funder)]
    pub funder_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
```

Transfers `(approved_amount / total_approved_amount) * TOKENS_TO_PARTICIPANTS` tokens to funder.

---

### 9. `refund` — UNCHANGED

```rust
#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut, has_one = launch_quote_vault, has_one = launch_signer)]
    pub launch: Account<'info, Launch>,
    #[account(mut, has_one = launch, has_one = funder)]
    pub funding_record: Account<'info, FundingRecord>,
    #[account(mut)]
    pub launch_quote_vault: Account<'info, TokenAccount>,
    pub launch_signer: UncheckedAccount<'info>,
    pub funder: UncheckedAccount<'info>,
    #[account(mut, associated_token::mint = launch.quote_mint, associated_token::authority = funder)]
    pub funder_quote_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
```

Refunds USDC. If `Refunding` → full amount. If `Complete` → `committed - approved`.

---

### 10. `claim_additional_token_allocation` — UNCHANGED

```rust
#[derive(Accounts)]
pub struct ClaimAdditionalTokenAllocation<'info> {
    #[account(mut, has_one = launch_base_vault, has_one = launch_signer, has_one = base_mint)]
    pub launch: Account<'info, Launch>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub launch_signer: UncheckedAccount<'info>,
    #[account(mut, associated_token::mint = base_mint, associated_token::authority = launch_signer)]
    pub launch_base_vault: Account<'info, TokenAccount>,
    pub base_mint: Account<'info, Mint>,
    pub additional_tokens_recipient: AccountInfo<'info>,
    #[account(init_if_needed, payer = payer, associated_token::mint = base_mint,
        associated_token::authority = additional_tokens_recipient)]
    pub additional_tokens_recipient_token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
```

Transfers `additional_tokens_amount` to recipient.

---

### 11. `extend_launch` — UNCHANGED

```rust
#[derive(Accounts)]
pub struct ExtendLaunch<'info> {
    #[account(mut)]
    pub launch: Account<'info, Launch>,
    pub admin: Signer<'info>,
}
```

Admin (metadao_multisig_vault in production) extends `seconds_for_launch`.

---

## Events

All events use CPI events (`#[event_cpi]` / `emit_cpi!`).

### Common fields

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
    pub launch_seq_num: u64,
}
```

### `LaunchInitializedEvent` — CHANGED

```rust
#[event]
pub struct LaunchInitializedEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub minimum_raise_amount: u64,
    pub launch_authority: Pubkey,
    pub launch_signer: Pubkey,
    pub launch_signer_pda_bump: u8,
    pub launch_usdc_vault: Pubkey,
    pub launch_token_vault: Pubkey,
    pub performance_package_grantee: Pubkey,
    pub performance_package_token_amount: u64,
    pub months_until_insiders_can_unlock: u8,
    pub monthly_spending_limit_amount: u64,
    pub monthly_spending_limit_members: Vec<Pubkey>,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub pda_bump: u8,
    pub seconds_for_launch: u32,
    pub additional_tokens_amount: u64,
    pub additional_tokens_recipient: Option<Pubkey>,
    pub accumulator_activation_delay_seconds: u32,
    pub has_bid_wall: bool,
    pub mint_governor: Pubkey,                      // NEW
}
```

### `LaunchStartedEvent` — UNCHANGED

```rust
#[event]
pub struct LaunchStartedEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub launch_authority: Pubkey,
    pub slot_started: u64,
}
```

### `LaunchFundedEvent` — UNCHANGED

```rust
#[event]
pub struct LaunchFundedEvent {
    pub common: CommonFields,
    pub funding_record: Pubkey,
    pub launch: Pubkey,
    pub funder: Pubkey,
    pub amount: u64,
    pub total_committed_by_funder: u64,
    pub total_committed: u64,
    pub committed_amount_accumulator: u128,
}
```

### `FundingRecordApprovalSetEvent` — UNCHANGED

```rust
#[event]
pub struct FundingRecordApprovalSetEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub funding_record: Pubkey,
    pub funder: Pubkey,
    pub approved_amount: u64,
    pub total_approved: u64,
}
```

### `LaunchCloseEvent` — UNCHANGED

```rust
#[event]
pub struct LaunchCloseEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub new_state: LaunchState,
}
```

### `LaunchSettledEvent` — CHANGED (renamed from `LaunchCompletedEvent`)

```rust
#[event]
pub struct LaunchSettledEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub final_state: LaunchState,
    pub total_committed: u64,
    pub dao: Option<Pubkey>,
    pub dao_treasury: Option<Pubkey>,
    pub total_approved_amount: u64,
    pub bid_wall: Option<Pubkey>,
    pub bid_wall_amount: u64,
    pub mint_governor: Pubkey,                      // NEW
    pub tokens_minted: u64,                         // NEW — total tokens minted in this tx
}
```

### `LaunchFinalizedEvent` — CHANGED (renamed from `LaunchPerformancePackageInitializedEvent`)

```rust
#[event]
pub struct LaunchFinalizedEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub performance_package: Pubkey,
    pub mint_governor: Pubkey,                      // NEW
    pub mint_governor_new_admin: Pubkey,            // NEW — the DAO vault
    pub pp_mint_authority: Pubkey,                  // NEW
}
```

### `LaunchRefundedEvent` — UNCHANGED

```rust
#[event]
pub struct LaunchRefundedEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub funder: Pubkey,
    pub usdc_refunded: u64,
    pub funding_record: Pubkey,
}
```

### `LaunchClaimEvent` — UNCHANGED

```rust
#[event]
pub struct LaunchClaimEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub funder: Pubkey,
    pub tokens_claimed: u64,
    pub funding_record: Pubkey,
}
```

### `LaunchClaimAdditionalTokenAllocationEvent` — UNCHANGED

```rust
#[event]
pub struct LaunchClaimAdditionalTokenAllocationEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub additional_tokens_amount: u64,
    pub additional_tokens_recipient: Pubkey,
}
```

### `LaunchExtendedEvent` — UNCHANGED

```rust
#[event]
pub struct LaunchExtendedEvent {
    pub common: CommonFields,
    pub launch: Pubkey,
    pub old_seconds_for_launch: u32,
    pub new_seconds_for_launch: u32,
}
```

---

## Errors

```rust
#[error_code]
pub enum LaunchpadError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Supply must be zero")]
    SupplyNonZero,
    #[msg("Launch period must be between 1 hour and 2 weeks")]
    InvalidSecondsForLaunch,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Invalid launch state")]
    InvalidLaunchState,
    #[msg("Launch period not over")]
    LaunchPeriodNotOver,
    #[msg("Launch is complete, no more funding allowed")]
    LaunchExpired,
    #[msg("Refund not available")]
    LaunchNotRefunding,
    #[msg("Launch must be initialized to be started")]
    LaunchNotInitialized,
    #[msg("Freeze authority can't be set on launchpad tokens")]
    FreezeAuthoritySet,
    #[msg("Monthly spending limit must be less than 1/6th of the minimum raise amount and cannot be 0")]
    InvalidMonthlySpendingLimit,
    #[msg("There can only be at most 10 monthly spending limit members")]
    InvalidMonthlySpendingLimitMembers,
    #[msg("Invalid performance package token amount")]
    InvalidPerformancePackageTokenAmount,
    #[msg("Insiders must wait at least 12 months before unlocking")]
    InvalidPerformancePackageMinUnlockTime,
    #[msg("Launch authority must be set to complete the launch until 2 days after closing")]
    LaunchAuthorityNotSet,
    #[msg("The final amount raised must be >= the minimum raise amount")]
    FinalRaiseAmountTooLow,
    #[msg("Tokens already claimed")]
    TokensAlreadyClaimed,
    #[msg("USDC already refunded")]
    MoneyAlreadyRefunded,
    #[msg("Invariant violated")]
    InvariantViolated,
    #[msg("Launch must be live to be closed")]
    LaunchNotLive,
    #[msg("Minimum raise amount too low for liquidity")]
    InvalidMinimumRaiseAmount,
    #[msg("Final raise amount already set")]
    FinalRaiseAmountAlreadySet,
    #[msg("Total approved amount too low")]
    TotalApprovedAmountTooLow,
    #[msg("Additional tokens recipient must be set when amount > 0")]
    InvalidAdditionalTokensRecipient,
    #[msg("No additional tokens recipient set")]
    NoAdditionalTokensRecipientSet,
    #[msg("Additional tokens already claimed")]
    AdditionalTokensAlreadyClaimed,
    #[msg("Funding record approval period is over")]
    FundingRecordApprovalPeriodOver,
    #[msg("Performance package already initialized")]
    PerformancePackageAlreadyInitialized,
    #[msg("Invalid DAO")]
    InvalidDao,
    #[msg("Accumulator activation delay must be less than the launch duration")]
    InvalidAccumulatorActivationDelaySeconds,
    #[msg("Extend duration would exceed maximum allowed launch duration")]
    ExtendDurationExceedsMax,
    #[msg("Mint authority does not match expected")]                     // NEW
    InvalidMintAuthority,
}
```

Same error variants as v7, reordered/renamed for clarity. `InvalidMintAuthority` added for MintGovernor account validation.

---

## SDK2 Client

### Directory: `sdk2/src/launchpad/v0.8/`

Files:
- `LaunchpadClient.ts`
- `pda.ts`
- `types/index.ts`
- `types/v08_launchpad.ts` (generated from IDL)
- `index.ts` (re-exports)

### `pda.ts`

```typescript
import { PublicKey } from "@solana/web3.js";
import { LAUNCHPAD_V0_8_PROGRAM_ID } from "../../constants.js";

export function getLaunchAddr(
  programId: PublicKey = LAUNCHPAD_V0_8_PROGRAM_ID,
  tokenMint: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("launch"), tokenMint.toBuffer()],
    programId,
  );
}

export const getLaunchSignerAddr = (
  programId: PublicKey = LAUNCHPAD_V0_8_PROGRAM_ID,
  launch: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("launch_signer"), launch.toBuffer()],
    programId,
  );
};

export const getFundingRecordAddr = (
  programId: PublicKey = LAUNCHPAD_V0_8_PROGRAM_ID,
  launch: PublicKey,
  funder: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("funding_record"), launch.toBuffer(), funder.toBuffer()],
    programId,
  );
};
```

PDA functions are identical to v0.7, just targeting the v0.8 program ID.

### `LaunchpadClient.ts`

```typescript
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey, ComputeBudgetProgram, SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";

// Type imports from generated IDL
import { V08Launchpad as Launchpad, IDL as LaunchpadIDL } from "./types/v08_launchpad.js";
import { Launch, FundingRecord } from "./types/index.js";

// PDA imports
import { getLaunchAddr, getLaunchSignerAddr, getFundingRecordAddr } from "./pda.js";
import { getEventAuthorityAddr, getMetadataAddr } from "../../pda.js";

// Sub-client imports
import { FutarchyClient, getDaoAddr } from "../../futarchy/v0.6/index.js";
import { MintGovernorClient, getMintGovernorAddr, getMintAuthorityAddr } from "../../mint_governor/v0.7/index.js";
import { PerformancePackageV2Client, getPerformancePackageV2Addr } from "../../performance_package_v2/v0.7/index.js";
import { BidWallClient } from "../../bid_wall/v0.7/index.js";
import * as multisig from "@sqds/multisig";

import {
  LAUNCHPAD_V0_8_PROGRAM_ID,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  MAINNET_USDC,
  SQUADS_PROGRAM_ID,
  SQUADS_PROGRAM_CONFIG,
  SQUADS_PROGRAM_CONFIG_TREASURY,
  SQUADS_PROGRAM_CONFIG_TREASURY_DEVNET,
  DAMM_V2_PROGRAM_ID,
  MINT_GOVERNOR_V0_7_PROGRAM_ID,
  PERFORMANCE_PACKAGE_V2_PROGRAM_ID,
  METADAO_MULTISIG_VAULT,
} from "../../constants.js";

export type CreateLaunchpadClientParams = {
  provider: AnchorProvider;
  launchpadProgramId?: PublicKey;
  autocratProgramId?: PublicKey;
  conditionalVaultProgramId?: PublicKey;
  mintGovernorProgramId?: PublicKey;
  performancePackageV2ProgramId?: PublicKey;
  bidWallProgramId?: PublicKey;
};

export class LaunchpadClient {
  public launchpad: Program<Launchpad>;
  public provider: AnchorProvider;
  public autocratClient: FutarchyClient;
  public mintGovernorClient: MintGovernorClient;
  public performancePackageV2Client: PerformancePackageV2Client;
  public bidWall: BidWallClient;

  private constructor(params: CreateLaunchpadClientParams) {
    this.provider = params.provider;
    this.launchpad = new Program(
      LaunchpadIDL,
      params.launchpadProgramId || LAUNCHPAD_V0_8_PROGRAM_ID,
      this.provider,
    );
    this.autocratClient = FutarchyClient.createClient({
      provider: this.provider,
      autocratProgramId: params.autocratProgramId,
      conditionalVaultProgramId: params.conditionalVaultProgramId,
    });
    this.mintGovernorClient = MintGovernorClient.createClient({
      provider: this.provider,
      programId: params.mintGovernorProgramId,
    });
    this.performancePackageV2Client = PerformancePackageV2Client.createClient({
      provider: this.provider,
      programId: params.performancePackageV2ProgramId,
    });
    this.bidWall = BidWallClient.createClient({
      provider: this.provider,
      bidWallProgramId: params.bidWallProgramId,
    });
  }

  static createClient(params: CreateLaunchpadClientParams): LaunchpadClient {
    return new LaunchpadClient(params);
  }

  getProgramId(): PublicKey {
    return this.launchpad.programId;
  }

  // ─── Fetch / Deserialize ────────────────────────────────────────────

  async getLaunch(launch: PublicKey): Promise<Launch> {
    return await this.launchpad.account.launch.fetch(launch);
  }

  async fetchLaunch(launch: PublicKey): Promise<Launch | null> {
    return await this.launchpad.account.launch.fetchNullable(launch);
  }

  async deserializeLaunch(accountInfo: AccountInfo<Buffer>): Promise<Launch> {
    return this.launchpad.coder.accounts.decode("launch", accountInfo.data);
  }

  async getFundingRecord(fundingRecord: PublicKey): Promise<FundingRecord> {
    return await this.launchpad.account.fundingRecord.fetch(fundingRecord);
  }

  async fetchFundingRecord(fundingRecord: PublicKey): Promise<FundingRecord | null> {
    return await this.launchpad.account.fundingRecord.fetchNullable(fundingRecord);
  }

  async deserializeFundingRecord(accountInfo: AccountInfo<Buffer>): Promise<FundingRecord> {
    return this.launchpad.coder.accounts.decode("fundingRecord", accountInfo.data);
  }

  // ─── Address Derivation ─────────────────────────────────────────────

  getLaunchAddress({ baseMint }: { baseMint: PublicKey }): PublicKey {
    return getLaunchAddr(this.launchpad.programId, baseMint)[0];
  }

  getLaunchSignerAddress({ launch }: { launch: PublicKey }): PublicKey {
    return getLaunchSignerAddr(this.launchpad.programId, launch)[0];
  }

  getMintGovernorAddress({ baseMint, launchSigner }: {
    baseMint: PublicKey;
    launchSigner: PublicKey;
  }): PublicKey {
    return getMintGovernorAddr({
      programId: this.mintGovernorClient.programId,
      mint: baseMint,
      createKey: launchSigner,
    })[0];
  }

  getMintAuthorityAddress({ mintGovernor, authorizedMinter }: {
    mintGovernor: PublicKey;
    authorizedMinter: PublicKey;
  }): PublicKey {
    return getMintAuthorityAddr({
      programId: this.mintGovernorClient.programId,
      mintGovernor,
      authorizedMinter,
    })[0];
  }

  getPerformancePackageAddress({ launch }: { launch: PublicKey }): PublicKey {
    const launchSigner = this.getLaunchSignerAddress({ launch });
    return getPerformancePackageV2Addr({
      programId: this.performancePackageV2Client.programId,
      createKey: launchSigner,
    })[0];
  }

  getLaunchDaoAddress({ launch }: { launch: PublicKey }): PublicKey {
    const launchSigner = this.getLaunchSignerAddress({ launch });
    return getDaoAddr({ nonce: new BN(0), daoCreator: launchSigner })[0];
  }

  getFundingRecordAddress({ launch, funder }: {
    launch: PublicKey;
    funder: PublicKey;
  }): PublicKey {
    return getFundingRecordAddr(this.launchpad.programId, launch, funder)[0];
  }

  // ─── Instruction Builders ───────────────────────────────────────────

  initializeLaunchIx({
    tokenName, tokenSymbol, tokenUri,
    minimumRaiseAmount, secondsForLaunch = 60 * 60 * 24 * 5,
    baseMint, quoteMint = MAINNET_USDC,
    monthlySpendingLimitAmount, monthlySpendingLimitMembers,
    performancePackageGrantee, performancePackageTokenAmount,
    monthsUntilInsidersCanUnlock, teamAddress,
    launchAuthority = this.provider.publicKey,
    payer = this.provider.publicKey,
    additionalTokensRecipient, additionalTokensAmount,
    accumulatorActivationDelaySeconds = 0,
    hasBidWall = false,
  }: {
    tokenName: string;
    tokenSymbol: string;
    tokenUri: string;
    minimumRaiseAmount: BN;
    secondsForLaunch?: number;
    baseMint: PublicKey;
    quoteMint?: PublicKey;
    monthlySpendingLimitAmount: BN;
    monthlySpendingLimitMembers: PublicKey[];
    performancePackageGrantee: PublicKey;
    performancePackageTokenAmount: BN;
    monthsUntilInsidersCanUnlock: number;
    teamAddress: PublicKey;
    launchAuthority?: PublicKey;
    payer?: PublicKey;
    additionalTokensRecipient?: PublicKey;
    additionalTokensAmount?: BN;
    accumulatorActivationDelaySeconds?: number;
    hasBidWall: boolean;
  }) {
    const [launch] = getLaunchAddr(this.launchpad.programId, baseMint);
    const [launchSigner] = getLaunchSignerAddr(this.launchpad.programId, launch);
    const quoteVault = getAssociatedTokenAddressSync(quoteMint, launchSigner, true);
    const baseVault = getAssociatedTokenAddressSync(baseMint, launchSigner, true);
    const [tokenMetadata] = getMetadataAddr(baseMint);

    // MintGovernor PDAs
    const [mintGovernor] = getMintGovernorAddr({
      programId: this.mintGovernorClient.programId,
      mint: baseMint,
      createKey: launchSigner,
    });
    const [mintAuthority] = getMintAuthorityAddr({
      programId: this.mintGovernorClient.programId,
      mintGovernor,
      authorizedMinter: launchSigner,
    });
    const [mintGovernorEventAuthority] = getEventAuthorityAddr(
      this.mintGovernorClient.programId,
    );

    return this.launchpad.methods
      .initializeLaunch({
        minimumRaiseAmount,
        secondsForLaunch,
        tokenName, tokenSymbol, tokenUri,
        monthlySpendingLimitAmount, monthlySpendingLimitMembers,
        performancePackageGrantee, performancePackageTokenAmount,
        monthsUntilInsidersCanUnlock, teamAddress,
        additionalTokensAmount: additionalTokensAmount ?? new BN(0),
        accumulatorActivationDelaySeconds,
        hasBidWall,
      })
      .accounts({
        launch, launchSigner,
        quoteVault, baseVault,
        launchAuthority, quoteMint, baseMint, tokenMetadata,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        payer,
        additionalTokensRecipient: additionalTokensRecipient ?? null,
        // New MintGovernor accounts
        mintGovernor,
        mintAuthority,
        mintGovernorProgram: this.mintGovernorClient.programId,
        mintGovernorEventAuthority,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          getAssociatedTokenAddressSync(quoteMint, launchSigner, true),
          launchSigner,
          quoteMint,
        ),
      ]);
  }

  startLaunchIx({ launch, launchAuthority = this.provider.publicKey }: {
    launch: PublicKey;
    launchAuthority?: PublicKey;
  }) {
    return this.launchpad.methods.startLaunch().accounts({
      launch, launchAuthority,
    });
  }

  fundIx({ launch, amount, funder = this.provider.publicKey, quoteMint = MAINNET_USDC }: {
    launch: PublicKey;
    amount: BN;
    funder?: PublicKey;
    quoteMint?: PublicKey;
  }) {
    const launchSigner = this.getLaunchSignerAddress({ launch });
    const launchQuoteVault = getAssociatedTokenAddressSync(quoteMint, launchSigner, true);
    const funderQuoteAccount = getAssociatedTokenAddressSync(quoteMint, funder, true);
    const [fundingRecord] = getFundingRecordAddr(this.launchpad.programId, launch, funder);

    return this.launchpad.methods.fund(amount).accounts({
      launch, launchQuoteVault, fundingRecord, funder, funderQuoteAccount,
    });
  }

  closeLaunchIx({ launch }: { launch: PublicKey }) {
    return this.launchpad.methods.closeLaunch().accounts({ launch });
  }

  setFundingRecordApprovalIx({ launch, funder, launchAuthority = this.provider.publicKey, approvedAmount }: {
    launch: PublicKey;
    funder: PublicKey;
    launchAuthority?: PublicKey;
    approvedAmount: BN;
  }) {
    const [fundingRecord] = getFundingRecordAddr(this.launchpad.programId, launch, funder);
    return this.launchpad.methods
      .setFundingRecordApproval(approvedAmount)
      .accounts({ launch, fundingRecord, launchAuthority });
  }

  settleLaunchIx({
    launch, quoteMint = MAINNET_USDC, baseMint, launchAuthority,
    isDevnet = false, meteoraConfig, feeRecipient = METADAO_MULTISIG_VAULT,
  }: {
    launch: PublicKey;
    quoteMint?: PublicKey;
    baseMint: PublicKey;
    launchAuthority: PublicKey | null;
    isDevnet?: boolean;
    meteoraConfig: PublicKey;
    feeRecipient?: PublicKey;
  }) {
    const launchSigner = this.getLaunchSignerAddress({ launch });
    const launchQuoteVault = getAssociatedTokenAddressSync(quoteMint, launchSigner, true);
    const launchBaseVault = getAssociatedTokenAddressSync(baseMint, launchSigner, true);
    const [tokenMetadata] = getMetadataAddr(baseMint);

    // DAO / Squads
    const [dao] = getDaoAddr({ nonce: new BN(0), daoCreator: launchSigner });
    const [multisigPda] = multisig.getMultisigPda({ createKey: dao });
    const [multisigVault] = multisig.getVaultPda({ multisigPda, index: 0 });
    const [spendingLimit] = multisig.getSpendingLimitPda({ multisigPda, createKey: dao });
    const treasuryQuoteAccount = getAssociatedTokenAddressSync(quoteMint, multisigVault, true);
    const [futarchyEventAuthority] = getEventAuthorityAddr(this.autocratClient.getProgramId());

    // Futarchy AMM
    const [ammPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_position"), dao.toBuffer(), multisigVault.toBuffer()],
      this.autocratClient.getProgramId(),
    );

    // MintGovernor
    const [mintGovernor] = getMintGovernorAddr({
      programId: this.mintGovernorClient.programId,
      mint: baseMint,
      createKey: launchSigner,
    });
    const [mintAuthority] = getMintAuthorityAddr({
      programId: this.mintGovernorClient.programId,
      mintGovernor,
      authorizedMinter: launchSigner,
    });
    const [mintGovernorEventAuthority] = getEventAuthorityAddr(
      this.mintGovernorClient.programId,
    );

    // Meteora (same as v7)
    const [poolAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_authority")], DAMM_V2_PROGRAM_ID,
    );
    const [positionNftMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("position_nft_mint"), baseMint.toBuffer()],
      this.launchpad.programId,
    );
    const [positionNftAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("position_nft_account"), positionNftMint.toBuffer()],
      DAMM_V2_PROGRAM_ID,
    );

    function getFirstKey(key1: PublicKey, key2: PublicKey) {
      return Buffer.compare(key1.toBuffer(), key2.toBuffer()) === 1
        ? key1.toBuffer() : key2.toBuffer();
    }
    function getSecondKey(key1: PublicKey, key2: PublicKey) {
      return Buffer.compare(key1.toBuffer(), key2.toBuffer()) === 1
        ? key2.toBuffer() : key1.toBuffer();
    }

    const [pool] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), meteoraConfig.toBuffer(),
       getFirstKey(baseMint, quoteMint), getSecondKey(baseMint, quoteMint)],
      DAMM_V2_PROGRAM_ID,
    );
    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), positionNftMint.toBuffer()], DAMM_V2_PROGRAM_ID,
    );
    const [tokenAVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_vault"), baseMint.toBuffer(), pool.toBuffer()], DAMM_V2_PROGRAM_ID,
    );
    const [tokenBVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_vault"), quoteMint.toBuffer(), pool.toBuffer()], DAMM_V2_PROGRAM_ID,
    );
    const [poolCreatorAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("damm_pool_creator_authority")], this.launchpad.programId,
    );
    const [dammV2EventAuthority] = getEventAuthorityAddr(DAMM_V2_PROGRAM_ID);

    // Bid wall
    const bidWall = this.bidWall.getBidWallAddress({
      baseMint, creator: launchSigner, nonce: new BN(0),
    });
    const bidWallQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, bidWall, true);

    return this.launchpad.methods
      .settleLaunch()
      .accounts({
        launch, launchSigner, launchQuoteVault, launchBaseVault,
        launchAuthority, dao, treasuryQuoteAccount, quoteMint, baseMint,
        tokenMetadata,
        daoOwnedLpPosition: ammPosition,
        futarchyAmmQuoteVault: getAssociatedTokenAddressSync(quoteMint, dao, true),
        futarchyAmmBaseVault: getAssociatedTokenAddressSync(baseMint, dao, true),
        squadsMultisig: multisigPda,
        squadsMultisigVault: multisigVault,
        spendingLimit, bidWall, bidWallQuoteTokenAccount, feeRecipient,
        // New MintGovernor accounts
        mintGovernor, mintAuthority,
        mintGovernorProgram: this.mintGovernorClient.programId,
        mintGovernorEventAuthority,
        // Nested (same as v7)
        staticAccounts: {
          futarchyProgram: this.autocratClient.getProgramId(),
          tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
          futarchyEventAuthority,
          squadsProgram: SQUADS_PROGRAM_ID,
          squadsProgramConfig: SQUADS_PROGRAM_CONFIG,
          squadsProgramConfigTreasury: isDevnet
            ? SQUADS_PROGRAM_CONFIG_TREASURY_DEVNET
            : SQUADS_PROGRAM_CONFIG_TREASURY,
          bidWallProgram: this.bidWall.programId,
          bidWallEventAuthority: this.bidWall.getEventAuthorityAddress(),
        },
        meteoraAccounts: {
          dammV2Program: DAMM_V2_PROGRAM_ID,
          positionNftMint, baseMint, quoteMint,
          config: meteoraConfig,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          positionNftAccount, pool, poolCreatorAuthority,
          position, tokenAVault, tokenBVault, poolAuthority,
          dammV2EventAuthority,
        },
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 800_000 }),
        ComputeBudgetProgram.requestHeapFrame({ bytes: 255 * 1024 }),
      ]);
  }

  finalizeLaunchIx({
    launch, baseMint, performancePackageGrantee,
    payer = this.provider.publicKey,
  }: {
    launch: PublicKey;
    baseMint: PublicKey;
    performancePackageGrantee: PublicKey;
    payer?: PublicKey;
  }) {
    const launchSigner = this.getLaunchSignerAddress({ launch });

    // DAO / Squads
    const [dao] = getDaoAddr({ nonce: new BN(0), daoCreator: launchSigner });
    const [multisigPda] = multisig.getMultisigPda({ createKey: dao });
    const [multisigVault] = multisig.getVaultPda({ multisigPda, index: 0 });

    // MintGovernor
    const [mintGovernor] = getMintGovernorAddr({
      programId: this.mintGovernorClient.programId,
      mint: baseMint,
      createKey: launchSigner,
    });

    // PP v2 PDA (create_key = launch_signer)
    const [performancePackage] = getPerformancePackageV2Addr({
      programId: this.performancePackageV2Client.programId,
      createKey: launchSigner,
    });

    // MintAuthority for PP v2
    const [ppMintAuthority] = getMintAuthorityAddr({
      programId: this.mintGovernorClient.programId,
      mintGovernor,
      authorizedMinter: performancePackage,
    });

    const [mintGovernorEventAuthority] = getEventAuthorityAddr(
      this.mintGovernorClient.programId,
    );
    const [ppV2EventAuthority] = getEventAuthorityAddr(
      this.performancePackageV2Client.programId,
    );

    return this.launchpad.methods
      .finalizeLaunch()
      .accounts({
        launch, launchSigner, baseMint, payer,
        dao, squadsMultisig: multisigPda, squadsMultisigVault: multisigVault,
        performancePackageGrantee,
        mintGovernor, ppMintAuthority, performancePackage,
        tokenProgram: TOKEN_PROGRAM_ID,
        squadsProgram: SQUADS_PROGRAM_ID,
        mintGovernorProgram: this.mintGovernorClient.programId,
        mintGovernorEventAuthority,
        performancePackageV2Program: this.performancePackageV2Client.programId,
        performancePackageV2EventAuthority: ppV2EventAuthority,
      });
  }

  refundIx({ launch, funder = this.provider.publicKey, quoteMint = MAINNET_USDC }: {
    launch: PublicKey;
    funder?: PublicKey;
    quoteMint?: PublicKey;
  }) {
    const [launchSigner] = getLaunchSignerAddr(this.launchpad.programId, launch);
    const [fundingRecord] = getFundingRecordAddr(this.launchpad.programId, launch, funder);
    const launchQuoteVault = getAssociatedTokenAddressSync(quoteMint, launchSigner, true);
    const funderQuoteAccount = getAssociatedTokenAddressSync(quoteMint, funder, true);

    return this.launchpad.methods.refund().accounts({
      launch, launchSigner, launchQuoteVault, funder, funderQuoteAccount, fundingRecord,
    });
  }

  claimIx(launch: PublicKey, baseMint: PublicKey, funder: PublicKey = this.provider.publicKey) {
    const [launchSigner] = getLaunchSignerAddr(this.launchpad.programId, launch);
    const [fundingRecord] = getFundingRecordAddr(this.launchpad.programId, launch, funder);

    return this.launchpad.methods.claim().accounts({
      launch, fundingRecord, launchSigner, funder, baseMint,
      funderTokenAccount: getAssociatedTokenAddressSync(baseMint, funder, true),
      launchBaseVault: getAssociatedTokenAddressSync(baseMint, launchSigner, true),
    }).preInstructions([
      createAssociatedTokenAccountIdempotentInstruction(
        this.provider.publicKey,
        getAssociatedTokenAddressSync(baseMint, funder, true),
        funder, baseMint,
      ),
    ]);
  }

  claimAdditionalTokenAllocationIx({ launch, baseMint, additionalTokensRecipient, payer = this.provider.publicKey }: {
    launch: PublicKey;
    baseMint: PublicKey;
    additionalTokensRecipient: PublicKey;
    payer?: PublicKey;
  }) {
    const launchSigner = this.getLaunchSignerAddress({ launch });

    return this.launchpad.methods.claimAdditionalTokenAllocation().accounts({
      launch, payer, launchSigner,
      launchBaseVault: getAssociatedTokenAddressSync(baseMint, launchSigner, true),
      baseMint, additionalTokensRecipient,
      additionalTokensRecipientTokenAccount: getAssociatedTokenAddressSync(
        baseMint, additionalTokensRecipient, true,
      ),
    });
  }

  extendLaunchIx({ launch, durationSeconds, admin = METADAO_MULTISIG_VAULT }: {
    launch: PublicKey;
    durationSeconds: number;
    admin?: PublicKey;
  }) {
    return this.launchpad.methods.extendLaunch({ durationSeconds }).accounts({
      launch, admin,
    });
  }
}
```

### `constants.ts` addition

```typescript
// Add to sdk2/src/constants.ts
export const LAUNCHPAD_V0_8_PROGRAM_ID = new PublicKey("MooNv7KbVWxQPCbCALJquw4D9pnVF7n8Nh2HmGqsxjg");
```

---

## Tests

### Directory: `tests/launchpad_v8/`

```
tests/launchpad_v8/
├── main.test.ts
├── utils.ts
└── unit/
    ├── initializeLaunch.test.ts
    ├── startLaunch.test.ts
    ├── fund.test.ts
    ├── closeLaunch.test.ts
    ├── setFundingRecordApproval.test.ts
    ├── settleLaunch.test.ts
    ├── finalizeLaunch.test.ts
    ├── claim.test.ts
    ├── refund.test.ts
    ├── claimAdditionalTokenAllocation.test.ts
    └── extendLaunch.test.ts
```

### `utils.ts`

Same pattern as v7 but targeting the v0.8 client:
- `initializeMintWithSeeds()` — creates a fresh mint with deterministic PDA
- Helpers to set up a full launch lifecycle (init → start → fund → close → approve → settle)

### Test Cases

Each `it()` block below maps 1:1 to a test. Tests marked **(v8-new)** are new for v8; all others carry over from v7.

#### `initializeLaunch.test.ts`

1. "initializes a launch with valid parameters"
   — Launch account state = Initialized, all fields correct, mint_governor stored
   — **(v8-new)** MintGovernor PDA initialized with admin = launch_signer, create_key = launch_signer
   — **(v8-new)** MintAuthority for launch_signer created with correct max_total
   — **(v8-new)** SPL mint authority is the MintGovernor PDA (not launch_signer)
   — **(v8-new)** base_vault has zero balance, base_mint.supply == 0
2. "fails when monthly spending limit members contains duplicates"
3. "fails when monthly spending limit members is empty"
4. "rejects accumulator activation delay >= seconds_for_launch"
5. "fails when launch signer is faked" — ConstraintSeeds error

#### `startLaunch.test.ts`

6. "starts launch correctly" — sets unix_timestamp_started, state = Live

#### `fund.test.ts`

7. "fails to fund the launch before it's started" — InvalidLaunchState
8. "successfully funds the launch" — transfers USDC, creates FundingRecord
9. "successfully funds the launch multiple times" — amounts accumulate correctly
10. "fails to fund the launch at the exact boundary second" — LaunchExpired at exact expiration
11. "fails to fund the launch after time expires" — LaunchExpired
12. "accumulator starts at 0 and last_accumulator_update is set on first fund"
13. "accumulator correctly sums across multiple time intervals"
14. "accumulator stays 0 during activation delay period"
15. "accumulator only counts time after activation delay"

#### `closeLaunch.test.ts`

16. "successfully closes launch after sufficient time when minimum raise is met" — state = Closed
17. "successfully closes launch after sufficient time when minimum raise is not met" — state = Refunding
18. "fails to close launch before sufficient time has passed" — LaunchPeriodNotOver
19. "fails to close launch when launch has already been closed" — LaunchNotLive
20. "fails to close launch when launch is still in Initialized state" — LaunchNotLive

#### `setFundingRecordApproval.test.ts`

21. "can set funding record approval for full, partial, and zero amounts"
22. "correctly updates the launch account total approved amount" — multiple funders
23. "can't set funding record approval before the launch period ends" — InvalidLaunchState
24. "can't set funding record approval after the funding record approval period ends (2 days)" — FundingRecordApprovalPeriodOver
25. "can't set funding record approval after the launch is completed" — InvalidLaunchState
26. "can't set funding record approval to an amount greater than the committed amount" — InsufficientFunds

#### `settleLaunch.test.ts`

27. "settles launch successfully when minimum raise is met"
    — **(v8-new)** tokens minted via MintGovernor (correct total = participants + futarchy_liq + damm_liq + additional)
    — **(v8-new)** base_mint.supply == expected total
    — **(v8-new)** MintAuthority.total_minted updated
    — **(v8-new)** MintGovernor admin is still launch_signer (NOT transferred yet)
    — DAO created, Futarchy AMM has liquidity, Meteora pool created
    — metadata update_authority transferred to DAO
    — USDC transferred to DAO treasury, state = Complete
28. "sends all USDC to treasury when hasBidWall is false even with excess funding"
29. "initializes bid wall when hasBidWall is true and funding exceeds 1.25x minimum raise"
30. "does not initialize bid wall when hasBidWall is true and funding equals minimum raise"
31. "does not initialize bid wall when hasBidWall is true and funding is exactly 1.25x minimum raise" — boundary
32. "sets state to Refunding when total_approved_amount < minimum_raise_amount" — no tokens minted, no DAO
33. "fails when launch is in refunding state" — InvalidLaunchState

#### `finalizeLaunch.test.ts`

34. "finalizes launch successfully after settle"
    — PP v2 MintAuthority created with authorized_minter = PP PDA, max_total = pp_token_amount
    — PP v2 account: oracle_reader = FutarchyTwap (amm = dao, min_duration = 3 months)
    — PP v2 account: reward_function = Threshold with 5 tranches at 2x/4x/8x/16x/32x
    — PP v2 account: recipient = performance_package_grantee, authority = squads_multisig_vault
    — PP v2 account: min_unlock_timestamp = completion_time + lockup months
    — MintGovernor admin transferred to squads_multisig_vault
    — is_performance_package_initialized = true
35. "fails when launch state is not Complete" — InvalidLaunchState
36. "can finalize only once" — PerformancePackageAlreadyInitialized

#### `claim.test.ts`

37. "successfully claims tokens after launch completion" — proportional amount
38. "fails when launch is not complete" — InvalidLaunchState

#### `refund.test.ts`

39. "allows refunds when launch is in refunding state" — full committed_amount
40. "works for oversubscribed launches" — refund = committed - approved
41. "fails when launch is not in refunding or complete state" — LaunchNotRefunding

#### `claimAdditionalTokenAllocation.test.ts`

42. "sets and claims additional token allocation successfully, and only once"
43. "fails to claim additional token allocation if the launch doesn't have one" — NoAdditionalTokensRecipientSet

#### `extendLaunch.test.ts`

44. "successfully extends a live launch" — seconds_for_launch increases
45. "funders can still fund after original deadline if extended"
46. "close_launch respects new extended deadline" — fails before new deadline

### Integration Test

```
tests/integration/launchpad_v8_full_lifecycle.test.ts
```

End-to-end test covering the full lifecycle including PP v2 unlock:
1. `initialize_launch` → verify zero supply, MintGovernor setup
2. `start_launch`
3. Multiple `fund` calls from different funders
4. Wait for launch period → `close_launch`
5. `set_funding_record_approval` for each funder
6. `settle_launch` → verify minting, DAO creation
7. `finalize_launch` → verify PP v2 setup, admin transfer
8. `claim` for each funder
9. `refund` for over-committed funders
10. `claim_additional_token_allocation`
11. (Optional) PP v2 `start_unlock` + `complete_unlock` cycle — verify tokens minted on demand via MintGovernor

---

## CPI Chain Summary

```
v08_launchpad::initialize_launch
  ├── mpl_token_metadata::create_metadata_accounts_v3
  ├── mint_governor::initialize_mint_governor
  ├── mint_governor::add_mint_authority (launch_signer)
  └── mint_governor::transfer_authority_to_governor

v08_launchpad::settle_launch
  ├── mint_governor::mint_tokens → base_vault
  ├── futarchy::initialize_dao
  ├── futarchy::provide_liquidity
  ├── bid_wall::initialize_bid_wall (if configured)
  ├── damm_v2::initialize_pool_with_dynamic_config
  ├── mpl_token_metadata::update_metadata_accounts_v2
  └── token::transfer (USDC → DAO treasury)

v08_launchpad::finalize_launch
  ├── mint_governor::add_mint_authority (PP v2 PDA)
  ├── performance_package_v2::initialize_performance_package
  └── mint_governor::update_mint_governor_admin → DAO
```

---

## Implementation Order

Build incrementally — each phase produces a testable program. Later phases layer on top without breaking earlier work.

### Phase 1: Scaffolding + State

Set up the `v08_launchpad` program crate, `lib.rs` with empty instruction stubs, constants, error enum, events module, and the `Launch` / `FundingRecord` state structs (with the new `mint_governor` field). Wire up Cargo dependencies (`mint_governor`, `performance_package_v2`, etc.). Add SDK2 `launchpad/v0.8/` directory with PDA helpers and type stubs.

Verify: `anchor build -p v08_launchpad` compiles.

### Phase 2: `initialize_launch`

The entry point — everything depends on this. Implement the full instruction including the MintGovernor CPI chain (init governor → add mint authority → transfer authority). No minting.

**Tests:** #1–5

### Phase 3: `start_launch` + `fund` + `close_launch`

These are unchanged from v7 and can be ported directly. They form the fundraising lifecycle that `settle_launch` depends on.

**Tests:** #6–20

### Phase 4: `set_funding_record_approval`

Unchanged from v7. Needed before settle_launch can run on the happy path (approved amounts determine what gets minted).

**Tests:** #21–26

### Phase 5: `settle_launch`

The big one — mints tokens via MintGovernor then runs the full DAO/liquidity/Meteora flow. This is the most complex instruction and requires phases 2–4 to be working.

**Tests:** #27–33

### Phase 6: `claim` + `refund` + `claim_additional_token_allocation`

Unchanged from v7. These operate on the post-settle state.

**Tests:** #37–43

### Phase 7: `finalize_launch`

The final instruction — adds PP v2 as authorized minter, initializes PP v2, transfers MintGovernor admin to DAO. Requires settle_launch to have run.

**Tests:** #34–36

### Phase 8: `extend_launch`

Unchanged from v7. Low priority since it's an admin-only emergency lever.

**Tests:** #44–46

### Phase 9: Integration test

Full lifecycle end-to-end — see Integration Test section above.
