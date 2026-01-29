# Mint Governor Program

## Overview

The Mint Governor program allows a DAO to transfer the mint authority of its token to a program-controlled PDA. This enables granular delegation of minting rights to multiple addresses with configurable limits, while maintaining a single admin that controls all delegations.

**Key Features:**
- Transfer mint authority to a program-controlled PDA
- Admin can grant/revoke mint rights to other addresses
- Optional total mint limits for delegated minters
- Admin can reclaim full mint authority if needed
- Tracking of total minted amounts per authorized minter

**MetaDAO-specific details**

- DAO’s Squads Multisig Vault would be the admin for the Mint Governor (or DAO, but this is less likely)  
- Mint Authority rights can then be given to:  
  - The Squads Multisig Vault  
  - Price-based performance package  
  - ???

---

## Account Structure

### MintGovernor (PDA)
The main account that holds configuration for a governed mint. Seeds: `["mint_governor", mint, create_key]`

The `create_key` is required to prevent frontrunning attacks. Without it, an attacker could race to create a MintGovernor for any mint and set themselves as admin before the legitimate party. The `create_key` must sign during initialization, ensuring only the intended party can create that specific PDA.

Note: Multiple MintGovernors can exist for the same mint (with different create_keys), but only one can hold the actual mint authority at a time.

```rust
pub struct MintGovernor {
    pub mint: Pubkey,           // The token mint being governed
    pub admin: Pubkey,          // Admin who can grant/revoke mint rights
    pub create_key: Pubkey,     // Key used in PDA derivation (anti-frontrun)
    pub seq_num: u64,           // Sequence number for event ordering (starts at 0)
    pub bump: u8,               // PDA bump
}
```

### MintAuthority
Represents an address that has been granted minting rights. Seeds: `["mint_authority", mint_governor, authorized_minter]`

```rust
pub struct MintAuthority {
    pub mint_governor: Pubkey,      // Reference to the governor
    pub authorized_minter: Pubkey,  // Address that can mint
    pub max_total: Option<u64>,     // Max total tokens this minter can ever mint (None = unlimited)
    pub total_minted: u64,          // Running total of tokens minted by this authority
    pub bump: u8,
}
```

---

## Instructions

### 1. `initialize_mint_governor`
Creates a MintGovernor account for a mint. Does NOT transfer authority yet.

**Accounts:**
- `mint` - The token mint
- `mint_governor` - PDA to create (seeds: `["mint_governor", mint, create_key]`)
- `create_key` - Key used in PDA derivation, prevents frontrunning (signer)
- `admin` - Will become the admin
- `payer` - Pays for account creation
- `system_program`

**Args:** None

**Emits:** `MintGovernorInitializedEvent`

---

### 2. `transfer_authority_to_governor`
Transfers the mint authority from current authority to the MintGovernor PDA.

**Accounts:**
- `mint` - The token mint (mut)
- `mint_governor` - The governor PDA (mut, for seq_num increment)
- `current_authority` - Current mint authority (signer)
- `token_program`

**Args:** None

**Checks:**
- `mint_governor.mint == mint.key()` - Ensures the governor is for this specific mint

**Emits:** `MintAuthorityTransferredEvent`

---

### 3. `add_mint_authority`
Admin grants minting rights to an address.

**Accounts:**
- `mint_governor` - The governor (mut, for seq_num increment)
- `mint_authority` - PDA to create for the authorized minter
- `admin` - Must be governor's admin (signer)
- `authorized_minter` - Address receiving mint rights
- `payer` - Pays for account creation
- `system_program`

**Args:**
- `max_total: Option<u64>` - Optional lifetime limit

**Emits:** `MintAuthorityAddedEvent`

---

### 4. `update_mint_authority`
Admin updates the limits for an existing authorized minter.

**Accounts:**
- `mint_governor` - The governor (mut, for seq_num increment)
- `mint_authority` - Existing authority account (mut)
- `admin` - Must be governor's admin (signer)

**Args:**
- `max_total: Option<u64>` - New lifetime limit

**Notes:**
- Setting `max_total` to a value less than or equal to `total_minted` acts as a "soft revoke" - the minter can no longer mint but their account and history remain intact.

**Emits:** `MintAuthorityUpdatedEvent`

---

### 5. `remove_mint_authority`
Admin revokes minting rights from an address, closing the account.

**Accounts:**
- `mint_governor` - The governor (mut, for seq_num increment)
- `mint_authority` - Authority account to close (mut)
- `admin` - Must be governor's admin (signer)
- `rent_destination` - Receives closed account rent

**Args:** None

**Emits:** `MintAuthorityRemovedEvent`

---

### 6. `mint_tokens`
An authorized minter mints tokens to a destination.

**Accounts:**
- `mint_governor` - The governor (mut, for seq_num increment)
- `mint_authority` - Minter's authority record (mut, for updating total_minted)
- `mint` - The token mint (mut)
- `destination` - Token account to mint to (mut)
- `authorized_minter` - Must match mint_authority.authorized_minter (signer)
- `token_program`

**Args:**
- `amount: u64` - Amount to mint

**Checks:**
- `total_minted + amount <= max_total` (if set)

**Emits:** `TokensMintedEvent`

---

### 7. `update_mint_governor_admin`
Admin transfers admin rights to a new address.

**Accounts:**
- `mint_governor` - The governor (mut, for admin update and seq_num increment)
- `admin` - Current admin (signer)
- `new_admin` - New admin address

**Args:** None

**Emits:** `MintGovernorAdminUpdatedEvent`

---

### 8. `reclaim_authority`
Admin reclaims the mint authority back from the program to any address.

**Accounts:**
- `mint_governor` - The governor (mut, for seq_num increment)
- `mint` - The token mint (mut)
- `admin` - Must be governor's admin (signer)
- `new_authority` - Address to receive mint authority
- `token_program`

**Args:** None

**Notes:**
- Existing MintAuthority accounts become non-functional after this call (they can no longer mint since the governor no longer holds authority). These accounts are intentionally left in place to preserve historical records and can be closed via `remove_mint_authority` if desired.

**Emits:** `MintAuthorityReclaimedEvent`

---

## Events

All events include `CommonFields` for consistent metadata:

```rust
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
    pub mint_governor_seq_num: u64,
}

impl CommonFields {
    pub fn new(clock: &Clock, mint_governor_seq_num: u64) -> Self {
        Self {
            slot: clock.slot,
            unix_timestamp: clock.unix_timestamp,
            mint_governor_seq_num,
        }
    }
}
```

### MintGovernorInitializedEvent
Emitted by: `initialize_mint_governor`

```rust
#[event]
pub struct MintGovernorInitializedEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub mint: Pubkey,
    pub admin: Pubkey,
    pub create_key: Pubkey,
    pub pda_bump: u8,
}
```

### MintAuthorityTransferredEvent
Emitted by: `transfer_authority_to_governor`

```rust
#[event]
pub struct MintAuthorityTransferredEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub mint: Pubkey,
    pub previous_authority: Pubkey,
}
```

### MintAuthorityAddedEvent
Emitted by: `add_mint_authority`

```rust
#[event]
pub struct MintAuthorityAddedEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub mint_authority: Pubkey,
    pub authorized_minter: Pubkey,
    pub max_total: Option<u64>,
}
```

### MintAuthorityUpdatedEvent
Emitted by: `update_mint_authority`

```rust
#[event]
pub struct MintAuthorityUpdatedEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub mint_authority: Pubkey,
    pub authorized_minter: Pubkey,
    pub previous_max_total: Option<u64>,
    pub new_max_total: Option<u64>,
}
```

### MintAuthorityRemovedEvent
Emitted by: `remove_mint_authority`

```rust
#[event]
pub struct MintAuthorityRemovedEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub authorized_minter: Pubkey,
    pub total_minted: u64,  // Final total before revocation
}
```

### TokensMintedEvent
Emitted by: `mint_tokens`

```rust
#[event]
pub struct TokensMintedEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub mint: Pubkey,
    pub authorized_minter: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
    pub post_total_minted: u64,      // Updated total for this minter
    pub post_mint_supply: u64,       // Updated total supply of the mint
}
```

### MintGovernorAdminUpdatedEvent
Emitted by: `update_mint_governor_admin`

```rust
#[event]
pub struct MintGovernorAdminUpdatedEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub previous_admin: Pubkey,
    pub new_admin: Pubkey,
}
```

### MintAuthorityReclaimedEvent
Emitted by: `reclaim_authority`

```rust
#[event]
pub struct MintAuthorityReclaimedEvent {
    pub common: CommonFields,
    pub mint_governor: Pubkey,
    pub mint: Pubkey,
    pub new_authority: Pubkey,
}
```

---

## Testing

Tests are organized as unit tests per instruction, following the pattern established in `tests/bidWall/`.

### Test Structure

```
tests/mintGovernor/
├── main.test.ts                           # Imports and describes all unit test suites
├── utils.ts                               # Shared helper functions
└── unit/
    ├── initializeMintGovernor.test.ts
    ├── transferAuthorityToGovernor.test.ts
    ├── addMintAuthority.test.ts
    ├── updateMintAuthority.test.ts
    ├── removeMintAuthority.test.ts
    ├── mintTokens.test.ts
    ├── updateMintGovernorAdmin.test.ts
    └── reclaimAuthority.test.ts
```

### Unit Tests by Instruction

#### `initialize_mint_governor`

| Test Case | Description |
|-----------|-------------|
| successfully initializes a mint governor | Creates MintGovernor PDA with correct fields (mint, admin, create_key, seq_num=0, bump) |
| fails when create_key does not sign | Rejects if the create_key account is not a signer |

#### `transfer_authority_to_governor`

| Test Case | Description |
|-----------|-------------|
| successfully transfers mint authority to governor | Transfers authority from current_authority to MintGovernor PDA |
| fails when current_authority is not the actual mint authority | Rejects if signer doesn't own mint authority |
| fails when mint_governor.mint does not match mint | Rejects if wrong governor PDA is provided |
| fails when governor does not hold authority after previous reclaim | Ensures transfer works correctly on re-transfer scenario |

#### `add_mint_authority`

| Test Case | Description |
|-----------|-------------|
| successfully adds mint authority with max_total | Creates MintAuthority PDA with limit set |
| successfully adds mint authority without max_total (unlimited) | Creates MintAuthority PDA with None limit |
| fails when admin is not the governor's admin | Rejects unauthorized admin |
| fails when mint_authority already exists | Rejects duplicate creation |

#### `update_mint_authority`

| Test Case | Description |
|-----------|-------------|
| successfully updates max_total to a new value | Updates limit from one value to another |
| successfully updates max_total to None (unlimited) | Removes limit |
| successfully updates max_total to value <= total_minted (soft revoke) | Sets limit that prevents further minting |
| fails when admin is not the governor's admin | Rejects unauthorized admin |
| fails when mint_authority does not exist | Rejects update on non-existent authority |

#### `remove_mint_authority`

| Test Case | Description |
|-----------|-------------|
| successfully removes mint authority | Closes MintAuthority account and returns rent |
| successfully removes mint authority that has minted tokens | Confirms historical minting doesn't block removal |
| fails when admin is not the governor's admin | Rejects unauthorized admin |
| fails when mint_authority does not exist | Rejects removal of non-existent authority |

#### `mint_tokens`

| Test Case | Description |
|-----------|-------------|
| successfully mints tokens within limit | Mints amount that stays under max_total |
| successfully mints tokens with unlimited authority | Mints with None max_total |
| successfully mints tokens up to exact limit | Mints exactly remaining quota |
| successfully mints multiple times accumulating total_minted | Verifies total_minted tracks correctly across calls |
| fails when amount exceeds remaining quota | Rejects mint that would exceed max_total |
| fails when authorized_minter is not the signer | Rejects unauthorized minter |
| fails when governor does not hold mint authority | Rejects if authority was reclaimed |
| fails when mint_authority.mint_governor does not match | Rejects mismatched authority/governor |

#### `update_mint_governor_admin`

| Test Case | Description |
|-----------|-------------|
| successfully updates admin | Transfers admin rights to new address |
| new admin can perform admin actions | Verifies new admin can add/remove authorities |
| old admin cannot perform admin actions after transfer | Verifies old admin is rejected |
| fails when admin is not the current admin | Rejects unauthorized admin change |

#### `reclaim_authority`

| Test Case | Description |
|-----------|-------------|
| successfully reclaims authority to new address | Transfers mint authority from PDA to new_authority |
| successfully reclaims authority back to admin | Admin can reclaim to themselves |
| existing mint authorities cannot mint after reclaim | Verifies MintAuthority accounts become non-functional |
| mint authorities can still be removed after reclaim | Verifies cleanup still works |
| fails when admin is not the governor's admin | Rejects unauthorized reclaim |
| fails when governor does not currently hold mint authority | Rejects if authority already transferred away |

---

## Potential Improvements

### Combine `add_mint_authority` and `update_mint_authority` into `set_mint_authority`

The `add_mint_authority` and `update_mint_authority` instructions could be combined into a single `set_mint_authority` instruction using Anchor's `init_if_needed` constraint. This would:

- Simplify the API from two instructions to one
- Make the instruction idempotent (calling with the same params produces consistent results)
- Reduce code duplication

**Implementation approach:**
```rust
#[account(
    init_if_needed,
    payer = payer,
    space = 8 + MintAuthority::INIT_SPACE,
    seeds = [MINT_AUTHORITY_SEED, mint_governor.key().as_ref(), authorized_minter.key().as_ref()],
    bump
)]
pub mint_authority: Account<'info, MintAuthority>,
```

The handler would detect if the account was freshly initialized (e.g., by checking if `bump == 0` before setting fields) and:
- On init: set all fields (`mint_governor`, `authorized_minter`, `max_total`, `total_minted = 0`, `bump`)
- On update: only update `max_total`

Different events could be emitted based on whether it was an init or update, or a single `MintAuthoritySetEvent` could include a boolean flag indicating if it was newly created.
