# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MetaDAO Futarchy Protocol - Solana programs for market-driven governance and token launches. Uses Anchor 0.29.0, Solana 1.17.34, Rust 1.78.0.

## Build & Test Commands

```bash
# Build all programs
anchor build

# Build specific program
anchor build -p futarchy
anchor build -p conditional_vault
# ...et cetera.

# Rebuild Programs, Rebuild SDK and lint (also surfaces any errors within SDK)
./rebuild.sh

# Run all tests (includes build)
anchor test

# Run tests without rebuilding (faster iteration)
anchor test --skip-build
```

## Project Structure

```
programs/                    # Solana programs (Anchor)
├── futarchy/               # DAO governance with TWAP oracles
├── conditional_vault/      # Conditional tokens for prediction markets
├── v07_launchpad/          # Token launch platform (current)
├── v06_launchpad/          # Previous launchpad version
├── bid_wall/               # Price floor mechanism
├── price_based_performance_package/  # Milestone-based rewards
├── mint_governor/          # Delegated minting authority management
└── damm_v2_cpi/            # Meteora AMM CPI wrapper

sdk/                         # TypeScript client library (@metadaoproject/programs)
├── src/<program>/          # One module per program (futarchy, launchpad, conditional_vault, ...)
│   ├── v0.X/               #   Each program is independently versioned
│   └── index.ts            #   Re-exports the latest version
└── package.json

tests/                       # TypeScript tests (bankrun + mocha)
├── conditionalVault/       # Unit + integration tests per program
├── futarchy/
├── launchpad/
├── bidWall/
├── integration/            # Cross-program workflow tests
├── fixtures/               # Pre-compiled external programs (.so)
└── utils.ts                # Testing utilities

scripts/                     # Deployment & setup scripts
└── v0.3/ - v0.7/           # Version-specific scripts

vibes/                       # Design documents and specs
```

## Program Development Patterns

### Instruction Structure (Anchor)
```rust
// In lib.rs - without params
#[program]
pub mod my_program {
    #[access_control(ctx.accounts.validate())]
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Initialize::handle(ctx)
    }

    // With params - use an Args struct
    #[access_control(ctx.accounts.validate(&args))]
    pub fn do_something(ctx: Context<DoSomething>, args: DoSomethingArgs) -> Result<()> {
        DoSomething::handle(ctx, args)
    }
}

// In instructions/initialize.rs - no params needed
#[derive(Accounts)]
pub struct Initialize<'info> { /* account constraints */ }

impl Initialize<'_> {
    pub fn validate(&self) -> Result<()> {
        // Validation logic (or just Ok(()))
        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        // Implementation
        Ok(())
    }
}

// In instructions/do_something.rs - with params
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DoSomethingArgs {
    pub amount: u64,
}

#[derive(Accounts)]
pub struct DoSomething<'info> { /* account constraints */ }

impl DoSomething<'_> {
    pub fn validate(&self, args: &DoSomethingArgs) -> Result<()> {
        // Validation that needs args
        require_gte!(args.amount, 1, MyError::InvalidAmount);
        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: DoSomethingArgs) -> Result<()> {
        // Implementation using args
        Ok(())
    }
}
```

### Account Constraints
When writing Anchor account constraints, prefer more specific constraint types over generic `constraint`:
1. `has_one` - when checking `account.field == other_account.key()` and field name matches account name
2. `address` - when checking against a known/constant address
3. `constraint` - only when the above don't apply (e.g., field name differs from account name)

```rust
// Good - uses has_one since field name matches account name
#[account(has_one = mint @ MyError::InvalidMint)]
pub mint_governor: Account<'info, MintGovernor>,

// Necessary - field name (authorized_minter) differs from account name (performance_package)
#[account(constraint = mint_authority.authorized_minter == performance_package.key() @ MyError::Invalid)]
pub mint_authority: Account<'info, MintAuthority>,
```

### Token Account Constraints
For token accounts, prefer `associated_token::*` over `token::*` constraints:
- `associated_token::mint` / `associated_token::authority` - enforces the account is at the canonical ATA address (safer, use for recipient/user-facing accounts)
- `token::mint` / `token::authority` - allows any token account with matching mint/authority (use only when flexibility is intentionally needed, e.g., source accounts where user may fund from non-ATA)

```rust
// Good - enforces canonical ATA for recipient
#[account(mut, associated_token::mint = mint, associated_token::authority = recipient)]
pub recipient_ata: Account<'info, TokenAccount>,

// OK - allows flexibility for source accounts
#[account(mut, token::mint = mint, token::authority = funder)]
pub funder_token_account: Account<'info, TokenAccount>,
```

### Events
Always use CPI events (`#[event_cpi]` on accounts structs, `emit_cpi!` for emission) rather than regular `emit!`.

### Require Macros
When writing validation checks, prefer specific require macros over generic `require!`:
1. `require_keys_eq!` - when comparing two `Pubkey` values
2. `require_eq!` - when comparing two values of the same type (requires `Display` trait)
3. `require_neq!` - when asserting two values are not equal (requires `Display` trait)
4. `require_gt!` / `require_gte!` - for greater than / greater than or equal comparisons
5. `require!` - for boolean conditions, including enum comparisons where the type doesn't implement `Display`

```rust
// Good - specific macros provide better error messages
require_keys_eq!(signer.key(), account.authority, MyError::Unauthorized);
require_eq!(account.count, 0, MyError::InvalidCount);  // integers implement Display
require_gte!(args.amount, 1, MyError::InvalidAmount);

// OK - enums typically don't implement Display, so use require!
require!(account.status == Status::Active, MyError::InvalidStatus);

// Avoid - generic require when a specific macro exists
require!(signer.key() == account.authority, MyError::Unauthorized);
```

### Error Enums
Always append new error variants to the **end** of `#[error_code]` enums. Anchor assigns error codes based on variant position (index), so inserting in the middle shifts all subsequent codes and breaks indexing/client-side error matching for deployed programs.

### After Editing Program Code
**Always run `./rebuild.sh` after modifying any Rust code under `programs/`.** This rebuilds all programs, regenerates the SDK types, and lints — ensuring tests run against your latest changes.

### Adding New Instructions
1. Add instruction to Rust program in `programs/[program]/src/instructions/`
2. Update client methods in the corresponding SDK module at the program's current version (e.g. `sdk/src/futarchy/v0.6/`, `sdk/src/launchpad/v0.7/`)
3. Add unit tests in `tests/[program]/unit/`

### Testing with Bankrun
Tests use `solana-bankrun` for deterministic testing without external RPC:
- `setupBasicDao()` - Create a test DAO with mints
- `advanceBySlots()` - Simulate time progression
- Time constants: `TEN_SECONDS_IN_SLOTS`, `ONE_MINUTE_IN_SLOTS`, `HOUR_IN_SLOTS`, `DAY_IN_SLOTS`

**Getting unique transaction signatures:** When testing error cases that call the same instruction multiple times (e.g., verifying an action fails after state changes), add a `ComputeBudgetProgram.setComputeUnitPrice()` instruction to make the transaction hash unique, so the retry isn't rejected as a duplicate of the earlier byte-identical transaction:

```typescript
// If the same call site needs several unique retries, increment microLamports (1, 2, ...).
await client
  .someIx({ ... })
  .postInstructions([
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
  ])
  .signers([signer])
  .rpc();
```

Do NOT use `setComputeUnitLimit()` for this — reserve it for genuinely raising a transaction's compute budget. Do NOT use `advanceBySlots()` either - it changes the clock which may affect time-dependent tests.

**Isolating tests during development:** When writing or editing tests, ALWAYS add `.only` to the `describe`/`it` block you're working on before running. This keeps feedback fast and output clean. Once your changes pass, remove `.only` and run the full suite (`anchor test --skip-build`) to confirm nothing else broke.

```typescript
// Run only this specific test
it.only("throws error when trying to split tokens after question is resolved", async function () {
  // ...
});

// Run only this describe block
describe.only("#split_tokens", function () {
  // ...
});
```

**Assertion messages:** Do not include assertion messages for better readability. The assertion itself should be clear enough:

```typescript
// Good - no message needed
assert.equal(recipientBalance.toString(), "500000000");
assert.isDefined(ppAccount.status.locked);

// Avoid - unnecessary message
assert.equal(recipientBalance.toString(), "500000000", "Recipient should have 500 tokens");
```

Exceptions: Keep messages in `expectError()` calls and `assert.fail()` within try-catch blocks, since those are part of error handling patterns and help identify which check failed.


**Token amounts in tests:** Use easy-to-read round numbers like hundreds or thousands of tokens. Our standard mint decimals is 6, so:
- 100 tokens = `100_000_000` (100 * 10^6)
- 1,000 tokens = `1_000_000_000` (1000 * 10^6)

This makes test assertions and calculations much easier to verify at a glance.

### Solana Reentrancy Guard
The Solana runtime prevents a program from appearing more than once in the same CPI stack. This affects two patterns in our codebase:

1. **futarchy → squads → futarchy** (e.g., admin-executing a DAO config change): Futarchy cannot CPI into Squads to execute a vault transaction whose inner instructions CPI back into futarchy. Workaround: futarchy only approves/validates the Squads transaction, then the client executes it as a separate top-level transaction.

2. **squads → futarchy → squads** (e.g., a team multisig that is itself a Squads wallet): If a Squads-initiated transaction calls a futarchy instruction that needs to CPI into Squads, the runtime will reject it. Workaround: have futarchy validate pre-created Squads accounts on-chain instead of creating them via CPI.

When designing instructions that involve Squads CPIs, check whether either pattern applies and flag it early. The general solution is: split the operation across multiple transactions — validate/approve in one, execute in another.

## SDK Usage

The SDK is published as `@metadaoproject/programs` and is organized **per program**, with each program independently versioned. There is no single SDK-wide version anymore — futarchy is at v0.6, launchpad is at v0.7, conditional_vault is at v0.4, etc.

```typescript
// Top-level imports resolve to the latest version of each program (preferred)
import {
  FutarchyClient,
  LaunchpadClient,
  ConditionalVaultClient,
  MAINNET_USDC,
} from "@metadaoproject/programs";

// Or import from a specific program module
import { FutarchyClient } from "@metadaoproject/programs/futarchy";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad";

// Or pin to a specific version (only when reading historical accounts or
// interacting with an older deployed program)
import { FutarchyClient } from "@metadaoproject/programs/futarchy/v0.6";
```

Each program module exports a `Client` class (constructed via `Client.createClient({ provider })`), PDA helpers, and generated Anchor types. Shared utilities (`constants.ts`, top-level `pda.ts`, `AmmMath`) are exported from the package root.

**Important:** Always use top-level or per-program imports for new code. Only reach for a versioned subpath (e.g. `@metadaoproject/programs/futarchy/v0.6`) when you specifically need an older program version. See `sdk/README.md` for the full layout.

## Key External Dependencies

- **Squads Multisig v4** - Governance authority for admin functions
- **Meteora DAMM** - Concentrated AMM for launches (via damm_v2_cpi)
- **OpenBook v2** - DEX integration (fixture in tests)

## Test Fixtures

External programs required for tests. These are pre-compiled `.so` files in `tests/fixtures/`:

**Critical dependencies (tests will fail without these):**
- `squads_multisig.so` - Squads Multisig v4 (`SQUADS_PROGRAM_ID`)
- `cp_amm.so` - Meteora DAMM v2 (`DAMM_V2_PROGRAM_ID`)
- `mpl_token_metadata.so` - Metaplex token metadata

**Other fixtures:**
- `openbook_v2.so`, `openbook_twap.so` - OpenBook DEX integration
- `raydium_cp_swap.so` - Raydium integration

## Troubleshooting

**"blockstore error"**: `rm -rf .anchor/test-ledger test-ledger`

**Module resolution errors**: `cd sdk && yarn build-local && cd .. && yarn install --force`

**Tests timeout**: Increase `startup_wait` in `Anchor.toml`

**Cargo.lock version error**: If `Cargo.lock` ends up with `version = 4`, simply change it back to `version = 3` to fix lockfile issues. You don't have to remove the lockfile.

## Mainnet Program IDs

| Program | Version | ID |
|---------|---------|-----|
| launchpad | v0.7.0 | `moontUzsdepotRGe5xsfip7vLPTJnVuafqdUWexVnPM` |
| bid_wall | v0.7.0 | `WALL8ucBuUyL46QYxwYJjidaFYhdvxUFrgvBxPshERx` |
| futarchy | v0.6.0 | `FUTARELBfJfQ8RDGhg1wdhddq1odMAJUePHFuBYfUxKq` |
| conditional_vault | v0.4 | `VLTX1ishMBbcX3rdBWGssxawAo1Q2X2qxYFYqiGodVg` |
| price_based_performance_package | v0.6.0 | `pbPPQH7jyKoSLu8QYs3rSY3YkDRXEBojKbTgnUg7NDS` |
| mint_governor | v0.7.0 | `gvnr27cVeyW3AVf3acL7VCJ5WjGAphytnsgcK1feHyH` |
| liquidation | v0.1.0 | `LiQnowFbFQdYyZhF4pUbpsrZCjxRTQ1upKJxZ2VXjde` |
