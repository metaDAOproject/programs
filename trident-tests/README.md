# Fuzzing Tests


## How to run the tests:


### 1. Install trident-cli

```bash
cargo install trident-cli --version 0.13.0-rc.2
```

### 2. Build the programs

```bash
# execute from project root
make build-all
```

> [!WARNING]
> Make sure the Solana-CLI version is 3.1.9.

### 3. Run the tests

```bash
trident fuzz run fuzz_0
# or another fuzz test by name
```


## Fuzz Test Suites

### fuzz_0 - Liquidity Operations
Exercises randomized `provide_liquidity` and `withdraw_liquidity` flows for multiple users after the pool is seeded with initial liquidity. The suite is mainly looking for accounting bugs in LP minting/burning, reserve updates, and per-user position tracking.

The invariants focus on ensuring deposits move assets from users into the pool, withdrawals move assets back out in the correct direction, LP position liquidity only changes consistently with the action taken, and no user can withdraw materially more than they have contributed apart from tiny rounding dust.

### fuzz_1 - Spot Trading
Exercises repeated `spot_swap` buy and sell operations against a seeded spot pool. It is focused on catching incorrect reserve updates, fee accounting mistakes, and trader balance changes that move opposite to the intended swap direction.

The invariants focus on swap-direction sanity for both the trader and the pool, plus end-of-iteration checks that on-chain spot reserves and protocol fee balances still reconcile with the DAO vault balances and that an empty pool cannot report non-zero reserves.

### fuzz_2 - Conditional Trading (Simple Principle)
Sets up an active futarchy proposal with conditional vaults and then fuzzes `conditional_swap` operations across the pass and fail markets. Instead of re-implementing the AMM pricing logic off-chain, this suite is aimed at detecting leaks, broken split/merge behavior, and incorrect conditional reserve movement through conservation-style checks.

The invariants focus on total underlying token conservation across tracked holders and vaults, pass/fail token parity for both base and quote legs, and simple trade-direction checks that the trader spends the input asset, receives the output asset, and moves the selected conditional pool reserves in the expected direction.

### fuzz_3 - Mixed Spot + Conditional Trading (Proposal Active)
Keeps the DAO in active `PoolState::Futarchy` and mixes `spot_swap` and `conditional_swap` flows in the same run. This is the most integration-heavy futarchy suite: it is designed to catch accounting mismatches between the spot pool, conditional pools, and vault balances while both trading modes interact during an active proposal.

The invariants focus on conservation of the underlying assets, pass/fail conditional token parity, directional sanity for both spot and conditional swaps, and aggregated vault-to-reserve alignment while the AMM is in futarchy mode. At the end of each run it also finalizes the proposal and checks that the system cleanly transitions back to spot mode with reserves and vault balances still aligned.

### fuzz_launchpad - Launch Lifecycle
Exercises the main `launchpad` lifecycle with mostly-valid but occasionally-invalid actions across `initialize_launch`, `start_launch`, `fund`, `close_launch`, `set_funding_record_approval`, `complete_launch`, `refund`, `claim`, and the post-completion paths for additional token allocation and performance package initialization. The suite is focused on state machine safety, custody of deposited funds, and making sure launch progression cannot be bypassed by malformed account combinations or bad signers.

The invariants focus on whether each instruction preserves the expected launch state transitions, whether funding records and approval amounts stay consistent with committed funds, whether successful completion/refund/claim paths pay out from the right vaults to the right parties, and whether optional post-launch distribution steps remain tied to the finalized launch state.

### fuzz_pbpp - Price Based Performance Package
Exercises the full performance package flow: `initialize_performance_package`, `start_unlock`, `complete_unlock`, authority changes, and proposal/execution of package updates. The suite is focused on the package state machine around oracle-driven unlocking as well as the authority and recipient control paths that can mutate package configuration.

The invariants focus on ensuring unlock only progresses when time and oracle conditions are satisfied, token release goes to the configured recipient path, administrative changes respect the expected authority/recipient permissions, and state transitions remain coherent as the package moves from locked to unlocking to completed or through approved configuration changes.

### fuzz_mint_governor - Mint Authorization And Limits
Exercises a simplified `mint_governor` flow centered on adding, updating, removing, and using a single mint authority. The suite is focused on two things only: unauthorized access should fail, and minting should respect the configured `max_total` limit for the authorized minter.

The invariants focus on keeping the tracked governor configuration stable after initialization and ensuring the tracked mint-authority PDA either does not exist when removed or matches the expected authorized minter, configured mint cap, and cumulative minted amount when active.
