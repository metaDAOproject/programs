# Performance Package v2 Program

## Overview

Performance Package v2 (PP v2) is a token minting program that rewards teams based on achieved milestones. It is the spiritual successor to `price_based_performance_package` (v1), with key architectural differences:

**Key Features:**
- Modular oracle system via inline enum `OracleReader` variants
- Configurable reward calculations via inline `RewardFunction` variants
- Two-phase lifecycle: Locked → Unlocking → Locked (repeats)
- Two-party approval for critical changes (authority + recipient must agree)
- Integration with `mint_governor` for token minting

**Comparison with v1:**

| Aspect | v1 | v2 |
|--------|----|----|
| Token source | Pre-funded vault | Minted via `mint_governor` |
| Reward logic | Fixed price tranches | Modular OracleReader + RewardFunction |
| Oracle types | Single Switchboard oracle | Multiple oracle types supported |
| Coexistence | Existing deployments remain | New launches use v2 |

---

## Constants

### MetaDAO Operational Multisig

The admin address for privileged operations (e.g., `close_performance_package`). Uses the same pattern as v1's `burn_performance_package`:

```rust
pub mod admin {
    use anchor_lang::prelude::declare_id;

    // MetaDAO operational multisig
    declare_id!("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
}
```

---

## Account Structure

### PerformancePackage (PDA)
The main account representing a performance package. Acts as the `authorized_minter` in mint_governor. Seeds: `["performance_package", create_key]`

```rust
pub struct PerformancePackage {
    // === Core References ===
    pub mint: Pubkey,                    // Token mint controlled by mint_governor
    pub mint_governor: Pubkey,           // MintGovernor account
    pub mint_authority: Pubkey,          // MintAuthority PDA for this PP

    // === Authorities ===
    pub authority: Pubkey,               // DAO multisig vault - can modify PP
    pub recipient: Pubkey,               // Team multisig - receives minted tokens

    // === Inline Configuration ===
    pub oracle_reader: OracleReader,     // Stores start/end snapshots
    pub reward_function: RewardFunction, // How to calculate rewards

    // === Lifecycle ===
    pub status: PackageStatus,           // Locked or Unlocking
    pub min_unlock_timestamp: i64,       // Can't start before this time

    // === Payout Tracking ===
    pub total_rewards_paid_out: u64,     // Cumulative tokens minted to recipient
    pub seq_num: u64,                    // Event sequence number

    // === PDA ===
    pub create_key: Pubkey,              // Used for PDA derivation
    pub bump: u8,
}
```

**Payout Logic:** `tokens_to_mint = reward_function.calculate(value) - total_rewards_paid_out`

### PackageStatus (Enum)
Lifecycle state for the performance package.

```rust
pub enum PackageStatus {
    Locked,   // Ready to start (or waiting for min_unlock_timestamp)
    Unlocking,  // Unlock in progress, waiting for min_duration
}
```

### OracleReader (Inline Enum)
An inline enum that knows how to read from an external oracle account. Extracts a `value: u128` and records snapshots for TWAP calculations.

```rust
pub enum OracleReader {
    /// Reads current timestamp from Clock::get()
    /// No state needed - just reads current time on demand
    Time,

    /// Reads accumulator from Futarchy AMM, computes TWAP
    /// Two snapshots: start (on start_unlock) and end (on complete_unlock)
    /// TWAP = (end_value - start_value) / (end_time - start_time)
    FutarchyTwap {
        amm: Pubkey,              // The Futarchy AMM account to read
        min_duration: u32,        // Minimum seconds between start and end
        // Start snapshot (recorded on start_unlock)
        start_value: u128,
        start_time: i64,
        // End snapshot (recorded on complete_unlock)
        end_value: u128,
        end_time: i64,
    },
}
```

**External Oracle Accounts:**

| OracleReader Variant | External Account(s) Needed | What It Reads |
|---------------------|---------------------------|---------------|
| `Time` | None (`Clock::get()`) | `unix_timestamp` |
| `FutarchyTwap` | Futarchy AMM | Price accumulator |

**Note:** All oracle sources are read via `remaining_accounts`. The `OracleReader` variant determines how many accounts to consume and how to interpret them.

### RewardFunction (Inline Enum)
An inline enum that calculates cumulative rewards from oracle values. Returns total tokens deserved so far (not incremental).

```rust
pub enum RewardFunction {
    /// Cliff + Linear: cliff_amount at cliff_value, then linear accrual to total_amount at end_value
    /// Works with any oracle value (e.g., time, price, or other metrics)
    /// For no-cliff behavior, set cliff_value = start_value and cliff_amount = 0
    CliffLinear {
        start_value: u128,
        cliff_value: u128,
        end_value: u128,
        cliff_amount: u64,
        total_amount: u64,        // Includes cliff
    },

    /// Threshold-based tranches (similar to v1)
    /// Each tranche: if value >= threshold, cumulative reward = amount
    Threshold {
        tranches: Vec<ThresholdTranche>,  // Must be sorted by threshold ascending
    },
}

pub struct ThresholdTranche {
    pub threshold: u128,          // Oracle value threshold
    pub cumulative_amount: u64,   // Total tokens at this level (not incremental)
}
```

### ChangeRequest (PDA)
Temporary account for two-party approval flow. Seeds: `["change_request", performance_package, proposer, pda_nonce.to_le_bytes()]`

```rust
pub struct ChangeRequest {
    pub performance_package: Pubkey,
    pub proposer_type: ProposerType,     // Who proposed
    pub proposed_at: i64,                // When proposed
    pub pda_nonce: u32,                  // For unique PDA derivation
    pub bump: u8,

    // === Optional Changes (at least one must be Some) ===
    pub new_recipient: Option<Pubkey>,
    pub new_oracle_reader: Option<OracleReader>,
    pub new_reward_function: Option<RewardFunction>,
}

pub enum ProposerType {
    Authority,
    Recipient,
}
```

---

## Instructions

### 1. `initialize_performance_package`
Creates a PerformancePackage account linked to a mint_governor.

**Accounts:**
- `performance_package` - PDA to create (seeds: `["performance_package", create_key]`)
- `mint` - The token mint
- `mint_governor` - The MintGovernor for this mint
- `mint_authority` - The MintAuthority PDA for this PP (must exist)
- `create_key` - Key used in PDA derivation (signer)
- `authority` - DAO multisig that will control the PP
- `recipient` - Team multisig that receives minted tokens
- `payer` - Pays for account creation
- `system_program`

**Args:**
- `oracle_reader: OracleReader` - Oracle configuration
- `reward_function: RewardFunction` - Reward calculation configuration
- `min_unlock_timestamp: i64` - Earliest time unlock can be started

**Checks:**
- `mint_governor.mint == mint.key()` - Governor controls correct mint
- `mint_authority.mint_governor == mint_governor.key()` - Authority belongs to governor
- `mint_authority.authorized_minter == performance_package.key()` - PP is the authorized minter
- Validates reward_function configuration (e.g., tranches sorted, vesting values ordered correctly)

**Emits:** `PerformancePackageCreatedEvent`

---

### 2. `start_unlock`
Begins the unlock period (starts oracle recording).

**Accounts:**
- `performance_package` - The PP (mut)
- `signer` - Must be authority or recipient (signer)

**Remaining Accounts:**
- `Time` → none
- `FutarchyTwap` → Futarchy AMM account

**Args:** None

**Checks:**
- `signer == pp.authority || signer == pp.recipient`
- `pp.status == Locked`
- `Clock::get().unix_timestamp >= pp.min_unlock_timestamp`

**Logic:**
1. Call `pp.oracle_reader.record_start(remaining_accounts)`
2. Set `pp.status = Unlocking`

**Emits:** `UnlockStartedEvent`

---

### 3. `complete_unlock`
Completes the unlock period, calculates rewards, mints tokens, and resets for next cycle.

**Accounts:**
- `performance_package` - The PP (mut, signer via PDA for CPI)
- `mint_governor` - Referenced by `pp.mint_governor`
- `mint_authority` - Referenced by `pp.mint_authority`
- `mint` - Referenced by `pp.mint` (mut)
- `recipient_ata` - Token account for `pp.recipient` (mut)
- `signer` - Must be authority or recipient (signer)
- `token_program`

**Remaining Accounts:**
- `Time` → none
- `FutarchyTwap` → Futarchy AMM account

**Args:** None

**Checks:**
- `signer == pp.authority || signer == pp.recipient`
- `pp.status == Unlocking`
- `pp.oracle_reader.can_end(Clock::get().unix_timestamp)` - min_duration passed
- `pp.mint_governor == mint_governor.key()`
- `pp.mint_authority == mint_authority.key()`
- `pp.mint == mint.key()`

**Logic:**
1. Call `pp.oracle_reader.record_end(remaining_accounts)`
2. Compute `value = pp.oracle_reader.compute_value()`
3. Compute `cumulative_rewards = pp.reward_function.calculate(value)`
4. If `cumulative_rewards > pp.total_rewards_paid_out`: (rewards only increase)
   - `mint_amount = cumulative_rewards - pp.total_rewards_paid_out`
   - CPI to `mint_governor::mint_tokens(mint_amount, recipient_ata)`
   - `pp.total_rewards_paid_out = cumulative_rewards`
5. Call `pp.oracle_reader.reset()` - prepare for next cycle
6. Set `pp.status = Locked`

**Emits:** `UnlockCompletedEvent`

---

### 4. `change_authority`
Transfers authority to a new address.

**Accounts:**
- `performance_package` - The PP (mut)
- `authority` - Must be PP's current authority (signer)
- `new_authority` - The new authority address

**Args:** None

**Checks:**
- `authority == pp.authority`

**Logic:**
1. `pp.authority = new_authority.key()`

**Notes:**
- Single-signer instruction - current authority can unilaterally transfer authority
- No approval from recipient required

**Emits:** `AuthorityChangedEvent`

---

### 5. `propose_change`
Proposes a change that requires two-party approval.

**Accounts:**
- `performance_package` - The PP (mut, for seq_num)
- `change_request` - PDA to create (seeds: `["change_request", pp, proposer, pda_nonce.to_le_bytes()]`)
- `proposer` - Must be authority or recipient (signer)
- `payer` - Pays for account creation
- `system_program`

**Args:**
- `pda_nonce: u32` - Unique nonce for PDA derivation (allows multiple concurrent proposals)
- `new_recipient: Option<Pubkey>` - New recipient address (if changing)
- `new_oracle_reader: Option<OracleReader>` - New oracle configuration (if changing)
- `new_reward_function: Option<RewardFunction>` - New reward function (if changing)

**Checks:**
- `proposer == pp.authority || proposer == pp.recipient`
- At least one of `new_recipient`, `new_oracle_reader`, or `new_reward_function` must be `Some`
- If `new_oracle_reader.is_some()`: validates the oracle configuration
- If `new_reward_function.is_some()`: validates the reward function configuration

**Logic:**
1. Determine `proposer_type` based on whether proposer is authority or recipient
2. Create ChangeRequest with optional fields, proposer_type, current timestamp, and pda_nonce

**Emits:** `ChangeProposedEvent`

---

### 6. `execute_change`
Executes a proposed change (opposite party must sign).

**Accounts:**
- `performance_package` - The PP (mut)
- `change_request` - The ChangeRequest account (mut, will be closed)
- `executor` - Must be opposite party from proposer (signer)
- `rent_destination` - Receives closed account rent

**Args:** None

**Checks:**
- `change_request.performance_package == pp.key()`
- If `proposer_type == Authority`, then `executor == pp.recipient`
- If `proposer_type == Recipient`, then `executor == pp.authority`
- If `new_oracle_reader.is_some() || new_reward_function.is_some()`: `pp.status == Locked` (can only update when not unlocking)

**Logic:**
Apply all `Some` fields from `change_request`:
- If `new_recipient.is_some()`: `pp.recipient = new_recipient.unwrap()`
- If `new_oracle_reader.is_some()`: `pp.oracle_reader = new_oracle_reader.unwrap()`
- If `new_reward_function.is_some()`: `pp.reward_function = new_reward_function.unwrap()`

Close `change_request` account after execution.

**Emits:** `ChangeExecutedEvent`

---

### 7. `close_performance_package`
Closes the PP (admin-only operation).

**Accounts:**
- `performance_package` - The PP (mut, will be closed)
- `admin` - MetaDAO operational multisig (signer)
- `rent_destination` - Receives closed account rent

**Args:** None

**Checks:**
- `admin == METADAO_ADMIN` (hardcoded operational multisig address)
- `pp.status == Locked` - Cannot close while unlocking

**Notes:**
- This is a destructive operation - any unpaid rewards are forfeited
- Consider doing a final `complete_unlock` before closing to claim any pending rewards
- Similar to v1's `burn_performance_package` instruction

**Emits:** `PerformancePackageClosedEvent`

---

## Events

All events include common fields for consistent metadata:

```rust
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
    pub performance_package_seq_num: u64,
}
```

### PerformancePackageCreatedEvent
Emitted by: `initialize_performance_package`

```rust
#[event]
pub struct PerformancePackageCreatedEvent {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub mint: Pubkey,
    pub mint_governor: Pubkey,
    pub authority: Pubkey,
    pub recipient: Pubkey,
    pub create_key: Pubkey,
    pub pda_bump: u8,
}
```

### UnlockStartedEvent
Emitted by: `start_unlock`

```rust
#[event]
pub struct UnlockStartedEvent {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub start_time: i64,
}
```

### UnlockCompletedEvent
Emitted by: `complete_unlock`

```rust
#[event]
pub struct UnlockCompletedEvent {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub oracle_value: u128,
    pub recipient: Pubkey,
    pub amount_minted: u64,
    pub total_rewards_paid_out: u64,  // Cumulative after this unlock
}
```

### AuthorityChangedEvent
Emitted by: `change_authority`

```rust
#[event]
pub struct AuthorityChangedEvent {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}
```

### ChangeProposedEvent
Emitted by: `propose_change`

```rust
#[event]
pub struct ChangeProposedEvent {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub change_request: Pubkey,
    pub proposer_type: ProposerType,
    pub pda_nonce: u32,
    pub new_recipient: Option<Pubkey>,
    pub new_oracle_reader: Option<OracleReader>,
    pub new_reward_function: Option<RewardFunction>,
}
```

### ChangeExecutedEvent
Emitted by: `execute_change`

```rust
#[event]
pub struct ChangeExecutedEvent {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub executed_by: Pubkey,
    pub new_recipient: Option<Pubkey>,
    pub new_oracle_reader: Option<OracleReader>,
    pub new_reward_function: Option<RewardFunction>,
}
```

### PerformancePackageClosedEvent
Emitted by: `close_performance_package`

```rust
#[event]
pub struct PerformancePackageClosedEvent {
    pub common: CommonFields,
    pub performance_package: Pubkey,
    pub total_rewards_paid_out: u64,  // Final cumulative amount paid
}
```

---

## Testing

Tests are organized as unit tests per instruction, following the pattern established in `tests/bidWall/` and `tests/mintGovernor/`.

### Test Structure

```
tests/performancePackageV2/
├── main.test.ts                           # Imports and describes all unit test suites
├── utils.ts                               # Shared helper functions
└── unit/
    ├── initializePerformancePackage.test.ts
    ├── startUnlock.test.ts
    ├── completeUnlock.test.ts
    ├── changeAuthority.test.ts
    ├── proposeChange.test.ts
    ├── executeChange.test.ts
    └── closePerformancePackage.test.ts
```

### Unit Tests by Instruction

#### `initialize_performance_package`

| Test Case | Description |
|-----------|-------------|
| successfully initializes with Time oracle and CliffLinear reward function | Creates PP with Time + CliffLinear |
| successfully initializes with FutarchyTwap oracle and CliffLinear reward function | Creates PP with FutarchyTwap + CliffLinear |
| successfully initializes with FutarchyTwap oracle and Threshold reward function | Creates PP with FutarchyTwap + Threshold |
| fails when create_key does not sign | Rejects if the create_key account is not a signer |
| fails when mint_authority.authorized_minter does not match PP | Rejects if MintAuthority wasn't set up for this PP |
| fails when mint_governor.mint does not match mint | Rejects if wrong governor is provided |
| fails with invalid reward function config | Rejects unsorted tranches, invalid timestamps, etc. |

#### `start_unlock`

| Test Case | Description |
|-----------|-------------|
| successfully starts when called by authority | Transitions Locked → Unlocking |
| successfully starts when called by recipient | Transitions Locked → Unlocking |
| records start snapshot for FutarchyTwap | Verifies start_value and start_time are set |
| fails when status is not Locked | Rejects if already Unlocking |
| fails when min_unlock_timestamp not reached | Rejects if current time < min_unlock_timestamp |
| fails when signer is neither authority nor recipient | Rejects unauthorized caller |
| fails when AMM account doesn't match for FutarchyTwap | Rejects wrong remaining account |

#### `complete_unlock`

| Test Case | Description |
|-----------|-------------|
| successfully completes unlock and mints tokens | Transitions Unlocking → Locked, mints tokens |
| records end snapshot for FutarchyTwap | Verifies end_value and end_time are set |
| correctly computes TWAP for FutarchyTwap | Verifies (end_value - start_value) / (end_time - start_time) |
| mints correct amount to recipient | Mints cumulative_rewards - total_rewards_paid_out |
| updates total_rewards_paid_out | Verifies tracking equals cumulative rewards after mint |
| resets oracle state | Verifies start/end values reset to 0 |
| rewards only increase (never decrease) | Verifies lower oracle value doesn't reduce rewards |
| succeeds with zero mint amount | No-op mint when rewards already paid |
| can be started again after complete | Verifies cycle can repeat |
| fails when status is not Unlocking | Rejects if Locked |
| fails when min_duration not reached | Rejects if oracle's min_duration hasn't passed |
| fails when signer is neither authority nor recipient | Rejects unauthorized caller |
| fails when mint_governor doesn't match | Rejects wrong governor |

#### `change_authority`

| Test Case | Description |
|-----------|-------------|
| successfully changes authority | Updates pp.authority to new address |
| new authority can perform authority actions | Verifies new authority can call start_unlock, etc. |
| old authority cannot perform authority actions after change | Verifies old authority is rejected |
| fails when signer is not current authority | Rejects unauthorized caller |

#### `propose_change`

| Test Case | Description |
|-----------|-------------|
| successfully proposes change when called by authority | Creates ChangeRequest with ProposerType::Authority |
| successfully proposes change when called by recipient | Creates ChangeRequest with ProposerType::Recipient |
| successfully proposes oracle change | Creates ChangeRequest with new_oracle_reader |
| successfully proposes reward function change | Creates ChangeRequest with new_reward_function |
| successfully proposes multiple changes at once | Creates ChangeRequest with multiple Some fields |
| allows multiple concurrent proposals with different nonces | Verifies pda_nonce uniqueness |
| fails when all optional fields are None | Rejects proposal with no changes |
| fails when signer is neither authority nor recipient | Rejects unauthorized caller |
| fails with invalid oracle config | Rejects invalid oracle_reader |
| fails with invalid reward function config | Rejects invalid reward_function |

#### `execute_change`

| Test Case | Description |
|-----------|-------------|
| successfully executes change (authority proposed, recipient signs) | Applies proposed changes to PP |
| successfully executes change (recipient proposed, authority signs) | Applies proposed changes to PP |
| successfully executes oracle change | Updates pp.oracle_reader |
| successfully executes reward function change | Updates pp.reward_function |
| successfully executes multiple changes at once | Applies all Some fields |
| closes change_request account | Verifies account closed and rent returned |
| fails when same party tries to propose and execute | Rejects self-approval |
| fails when change_request doesn't exist | Rejects missing proposal |
| fails when oracle change attempted while Unlocking | Rejects if pp.status != Locked |
| fails when reward function change attempted while Unlocking | Rejects if pp.status != Locked |

#### `close_performance_package`

| Test Case | Description |
|-----------|-------------|
| successfully closes PP when called by admin | Closes PP account |
| fails when caller is not admin | Rejects unauthorized caller |
| fails when status is Unlocking | Rejects if unlock in progress |

---

## Integration with mint_governor

PP v2 integrates with `mint_governor` as an authorized minter:

```
Setup:
1. Create MintGovernor for token mint (if not exists)
2. Admin calls mint_governor::add_mint_authority for PP's PDA
   - authorized_minter = PP PDA
   - max_total = optional cap for this PP
3. Create PP with references to mint_governor and mint_authority

Minting:
1. PP::complete_unlock calculates tokens to mint
2. CPI to mint_governor::mint_tokens
   - PP PDA signs as authorized_minter
   - Tokens minted to recipient's ATA
3. mint_governor updates MintAuthority.total_minted
4. PP updates its own tracking
```

**Caps:**
- `MintAuthority.max_total`: Package-level cap (optional, set by admin)
- `RewardFunction` max: Per-function cap (embedded in function parameters)

---

## Error Conditions

```rust
pub enum PerformancePackageError {
    // Authorization
    Unauthorized,                    // Signer is neither authority nor recipient
    InvalidExecutor,                 // Executor is not the opposite party from proposer

    // State
    NotLocked,                       // Expected Locked status
    NotUnlocking,                    // Expected Unlocking status

    // Oracle
    OracleMissingAccount,            // Expected remaining_accounts not provided
    OracleInvalidAccount,            // Account pubkey doesn't match expected
    OracleParseError,                // Failed to parse account data
    OracleInvalidState,              // Oracle state invalid (e.g., time_delta == 0)
    OracleMinDurationNotReached,     // min_duration hasn't passed yet

    // Time
    UnlockTimestampNotReached,       // min_unlock_timestamp not yet reached

    // Rewards
    RewardCalculationOverflow,       // Math overflow in reward function

    // Configuration
    InvalidTranches,                 // Tranches not sorted or empty
    InvalidVestingSchedule,          // Cliff value after end value, start > cliff, etc.

    // Change Requests
    ChangeRequestNotFound,           // Missing proposal for execute
    NoChangesProposed,               // All optional change fields are None
}
```

---

## Potential Improvements

### Add ChangeRequest rejection instruction

Allow the non-proposing party to reject (close) a ChangeRequest, refunding SOL to proposer. This provides an explicit "no" signal rather than leaving proposals hanging indefinitely.

### Support for multiple oracle sources

Some reward scenarios might benefit from combining multiple oracle values (e.g., price AND time conditions). This could be implemented as a composite oracle reader that consumes multiple accounts from `remaining_accounts`:

```rust
OracleReader::Composite {
    oracle_count: u8,             // Number of oracle accounts to read from remaining_accounts
    combiner: CombineFunction,    // Min, Max, Average, etc.
}
```

### Multiple PPs for complex schedules

For scenarios requiring multiple independent reward schedules (e.g., price milestones AND time vesting), create separate Performance Packages. Each PP operates independently with its own oracle and reward function.
