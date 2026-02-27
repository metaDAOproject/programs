# Fuzzing Tests


In case you receive an error like "Access violation in stack frame 5 at address 0x200005eb0 of size 8". Use this quide in order to fix it.

- Install trident-cli -- `cargo install trident-cli --version 0.13.0-rc.1`

- Make sure that `trident-test/cargo.toml` has

```rust
[dependencies.trident-fuzz]
version = "0.13.0-rc.1"
features = ["token"]
```

- Leave the anchor lang dependency as it is.

- In order to compile use `cargo build-sbf --manifest-path programs/futarchy/Cargo.toml --arch v2` (or similar for other programs) -- with solana-cli version 3.1.9.

- Make sure that the Trident.toml points to the correct location to load the program from.

- If above done, call `trident fuzz run fuzz_0`

## Fuzz Test Suites

### fuzz_0 - Liquidity Operations
Focuses on `provide_liquidity` and `withdraw_liquidity` instructions with simple invariants:
- Users cannot withdraw more tokens than they deposited (prevents theft)
- Token balances and reserves maintain consistency
- Position liquidity accounting is correct

### fuzz_1 - Spot Trading
Focuses on `spot_swap` instructions with simple invariants:
- Buy swaps: trader base balance increases, quote balance decreases; pool base reserves decrease, quote reserves increase
- Sell swaps: trader base balance decreases, quote balance increases; pool base reserves increase, quote reserves decrease
- Reserve accounting matches DAO vault balances
- Pool maintains consistency (empty pool has zero reserves)

### fuzz_2 - Conditional Trading (Simple Principle)
For conditional trading we avoid re-implementing AMM math in the fuzz test.
Instead, we check conservation-style invariants and token parity:

- Underlying token conservation:
  - Total `base` across tracked holders + base conditional vault underlying account stays constant.
  - Total `quote` across tracked holders + quote conditional vault underlying account stays constant.
- Conditional token parity:
  - Total pass-base equals total fail-base (over tracked owners).
  - Total pass-quote equals total fail-quote (over tracked owners).
- Per-swap direction sanity:
  - Trader input token does not increase.
  - Trader output token does not decrease.
  - Market pool reserve direction matches swap type (buy/sell).

This catches leaks/mint-burn inconsistencies while staying independent from internal pricing/arbitrage math.

### fuzz_3 - Mixed Spot + Conditional Trading (Proposal Active)
This suite keeps DAO in `PoolState::Futarchy` (proposal launched and active) and fuzzes both:
- `spot_swap` flows for Alice/Bob
- `conditional_swap` (pass/fail, buy/sell) flows for Alice/Bob

Invariant idea for this mixed suite:

- Global conservation (no hidden mint/burn):
  - Total tracked `base` underlying remains constant.
  - Total tracked `quote` underlying remains constant.
- Conditional parity:
  - Total pass-base equals total fail-base (over tracked owners).
  - Total pass-quote equals total fail-quote (over tracked owners).
- Conditional trade sanity:
  - Trader input token should not increase.
  - Trader output token should not decrease.
  - Selected conditional market reserves move in the expected direction.
- Spot trade sanity (while AMM is Futarchy):
  - Spot buy: trader base should not decrease, trader quote should not increase.
  - Spot sell: trader base should not increase, trader quote should not decrease.

Why this approach: we validate accounting and directional behavior without copying the full
on-chain pricing/arbitrage math into the fuzz test.
