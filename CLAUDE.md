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

sdk/                         # TypeScript client library
├── src/v0.3/ - v0.7/       # Versioned SDKs (backward compatible)
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

### Adding New Instructions
1. Add instruction to Rust program in `programs/[program]/src/instructions/`
2. Update client methods in SDK (`sdk/src/v0.7/`)
3. Add unit tests in `tests/[program]/unit/`
4. Run `./rebuild.sh` to sync types

### Testing with Bankrun
Tests use `solana-bankrun` for deterministic testing without external RPC:
- `setupBasicDao()` - Create a test DAO with mints
- `advanceBySlots()` - Simulate time progression
- Time constants: `TEN_SECONDS_IN_SLOTS`, `ONE_MINUTE_IN_SLOTS`, `HOUR_IN_SLOTS`, `DAY_IN_SLOTS`

## SDK Usage

```typescript
// Import versioned clients
import { FutarchyClient, ConditionalVaultClient } from "@metadaoproject/futarchy/v0.7";

// Key utilities in sdk/src/v0.7/
// - constants.ts: Program IDs, MAINNET_USDC, SQUADS_PROGRAM_ID
// - PDA derivation: getDaoAddr, getProposalAddr, etc.
// - PriceMath.getAmmPrice for price calculations
```

**Important:** Always use SDK v0.7 imports (`@metadaoproject/futarchy/v0.7`) for new code. Do not use older SDK versions (v0.3-v0.6).

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
